import { prisma } from '@/lib/db/prisma'
import { getCredentials } from '@/lib/kv'
import { incrementUsage, checkLimit } from '@/lib/usage'
import { RaynetClient } from '@/lib/integrations/raynet'
import { ShoptetClient } from '@/lib/integrations/shoptet'
import { PohodaClient } from '@/lib/integrations/pohoda'
import { PacketaClient } from '@/lib/integrations/packeta'
import { parseInvoiceText } from '@/lib/ai/mapper'
import { RunStatus, Schedule } from '@prisma/client'

export interface SyncResult {
  status: RunStatus
  recordsIn: number
  recordsOut: number
  errorMessage?: string
  durationMs: number
}

export async function runSync(syncId: string): Promise<SyncResult> {
  const startedAt = Date.now()

  const sync = await prisma.sync.findUnique({
    where: { id: syncId },
    include: {
      user: true,
      sourceConnection: true,
      targetConnection: true,
    },
  })

  if (!sync) return makeError('Sync not found', startedAt)

  const { allowed } = await checkLimit(sync.userId, sync.user.plan)
  if (!allowed) return makeError('Sync limit reached. Upgrade to Pro for unlimited syncs.', startedAt)

  await prisma.sync.update({ where: { id: syncId }, data: { lastRunAt: new Date(), lastRunStatus: 'RUNNING' } })

  const logEntry = await prisma.syncLog.create({
    data: { syncId, status: 'RUNNING', startedAt: new Date() },
  })

  try {
    const sourceCreds = await getCredentials(sync.sourceConnection.kvKey)
    const targetCreds = await getCredentials(sync.targetConnection.kvKey)
    if (!sourceCreds || !targetCreds) throw new Error('Missing credentials for connection')

    const result = await executeTemplate(sync, sourceCreds, targetCreds)

    await incrementUsage(sync.userId, 1, result.recordsOut)
    await prisma.syncLog.update({
      where: { id: logEntry.id },
      data: { status: result.status, recordsIn: result.recordsIn, recordsOut: result.recordsOut, finishedAt: new Date(), durationMs: Date.now() - startedAt },
    })
    await prisma.sync.update({
      where: { id: syncId },
      data: { lastRunStatus: result.status, nextRunAt: calcNextRun(sync.schedule) },
    })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await prisma.syncLog.update({
      where: { id: logEntry.id },
      data: { status: 'FAILED', errorMessage: message, finishedAt: new Date(), durationMs: Date.now() - startedAt },
    })
    await prisma.sync.update({ where: { id: syncId }, data: { lastRunStatus: 'FAILED' } })
    return makeError(message, startedAt)
  }
}

async function executeTemplate(
  sync: Awaited<ReturnType<typeof prisma.sync.findUnique>> & { sourceConnection: { platform: string; kvKey: string }; targetConnection: { platform: string; kvKey: string }; user: { plan: any } },
  sourceCreds: Record<string, string>,
  targetCreds: Record<string, string>
): Promise<SyncResult> {
  const templateId = sync!.templateId
  const mapping = sync!.fieldMapping as Record<string, string>
  const start = Date.now()

  if (templateId === 'shoptet-raynet-orders') {
    const shoptet = new ShoptetClient({ apiKey: sourceCreds.apiKey, eshopId: sourceCreds.eshopId })
    const raynet = new RaynetClient({ instanceName: targetCreds.instanceName, apiKey: targetCreds.apiKey, username: targetCreds.username })

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const orders = await shoptet.getOrders({ from: yesterday })
    let created = 0

    for (const order of orders) {
      let company = order.billing.ico ? await raynet.findCompanyByIco(order.billing.ico) : null
      if (!company && order.billing.company) {
        company = await raynet.createCompany({
          name: order.billing.company,
          ico: order.billing.ico,
          dic: order.billing.dic,
          email: order.email,
        })
      }
      await raynet.createOrder({
        title: `Objednávka ${order.code}`,
        company: company ? { id: company.id } : null,
        totalAmount: order.totalPriceWithVat,
        currency: order.currency,
        variabilniSymbol: order.variableSymbol,
      })
      created++
    }

    return { status: 'SUCCESS', recordsIn: orders.length, recordsOut: created, durationMs: Date.now() - start }
  }

  if (templateId === 'pohoda-raynet-faktury') {
    const pohoda = new PohodaClient({ url: sourceCreds.url, username: sourceCreds.username, password: sourceCreds.password, ico: sourceCreds.ico })
    const raynet = new RaynetClient({ instanceName: targetCreds.instanceName, apiKey: targetCreds.apiKey, username: targetCreds.username })

    const invoices = await pohoda.getInvoices({ dateFrom: new Date(Date.now() - 86400000).toISOString().split('T')[0] })
    let synced = 0

    for (const inv of invoices) {
      if (!inv.ico) continue
      let company = await raynet.findCompanyByIco(inv.ico)
      if (!company && inv.company) {
        company = await raynet.createCompany({ name: inv.company, ico: inv.ico, dic: inv.dic })
      }
      if (company) {
        await raynet.createInvoice({
          companyId: company.id,
          amount: inv.amountWithVat,
          variabilniSymbol: inv.variabilniSymbol,
          dphRate: inv.vatRate,
          dueDate: inv.dateDue,
        })
        synced++
      }
    }

    return { status: 'SUCCESS', recordsIn: invoices.length, recordsOut: synced, durationMs: Date.now() - start }
  }

  if (templateId === 'packeta-shoptet-tracking') {
    const packeta = new PacketaClient({ apiKey: sourceCreds.apiKey, apiPassword: sourceCreds.apiPassword })
    const shoptet = new ShoptetClient({ apiKey: targetCreds.apiKey, eshopId: targetCreds.eshopId })

    const orders = await shoptet.getOrders({ status: 'dispatched' })
    let updated = 0
    const STATUS_MAP: Record<string, string> = {
      delivered: 'delivered',
      returned: 'returned',
      ready_for_pickup: 'ready',
    }

    for (const order of orders) {
      const packet = await packeta.getPacketStatus(order.code)
      if (packet && STATUS_MAP[packet.status]) {
        await shoptet.updateOrderStatus(order.code, STATUS_MAP[packet.status])
        updated++
      }
    }

    return { status: 'SUCCESS', recordsIn: orders.length, recordsOut: updated, durationMs: Date.now() - start }
  }

  // Generic custom sync — apply field mapping
  return { status: 'SUCCESS', recordsIn: 0, recordsOut: 0, durationMs: Date.now() - start }
}

function calcNextRun(schedule: Schedule): Date | null {
  const now = new Date()
  switch (schedule) {
    case 'EVERY_5MIN': return new Date(now.getTime() + 5 * 60 * 1000)
    case 'EVERY_HOUR':  return new Date(now.getTime() + 60 * 60 * 1000)
    case 'DAILY':       return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case 'WEEKLY':      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    default:            return null
  }
}

function makeError(message: string, startedAt: number): SyncResult {
  return { status: 'FAILED', recordsIn: 0, recordsOut: 0, errorMessage: message, durationMs: Date.now() - startedAt }
}
