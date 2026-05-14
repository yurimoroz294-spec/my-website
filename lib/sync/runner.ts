import { prisma } from '@/lib/db/prisma'
import { getCredentials } from '@/lib/kv'
import { reserveSyncSlot, incrementUsage, getCurrentMonth } from '@/lib/usage'
import { RaynetClient } from '@/lib/integrations/raynet'
import { ShoptetClient } from '@/lib/integrations/shoptet'
import { PohodaClient } from '@/lib/integrations/pohoda'
import { PacketaClient } from '@/lib/integrations/packeta'
import { AirtableClient } from '@/lib/integrations/airtable'
import { RunStatus, Schedule } from '@prisma/client'

export interface SyncResult {
  status: RunStatus
  recordsIn: number
  recordsOut: number
  errorMessage?: string
  durationMs: number
}

interface PartialCounts {
  recordsIn: number
  recordsOut: number
  errors: number
}

function finalStatus(c: PartialCounts): RunStatus {
  if (c.recordsIn === 0) return 'SUCCESS'
  if (c.errors === 0) return 'SUCCESS'
  if (c.recordsOut === 0) return 'FAILED'
  return 'PARTIAL'
}

export async function runSync(syncId: string): Promise<SyncResult> {
  const startedAt = Date.now()

  const sync = await prisma.sync.findUnique({
    where: { id: syncId },
    include: { user: true, sourceConnection: true, targetConnection: true },
  })

  if (!sync) return makeError('Sync not found', startedAt)

  const month = getCurrentMonth()
  const reserved = await reserveSyncSlot(sync.userId, sync.user.plan, month)
  if (!reserved) return makeError('Sync limit reached. Upgrade to Pro for unlimited syncs.', startedAt)

  await prisma.sync.update({ where: { id: syncId }, data: { lastRunAt: new Date(), lastRunStatus: 'RUNNING' } })

  const logEntry = await prisma.syncLog.create({
    data: { syncId, status: 'RUNNING', startedAt: new Date() },
  })

  try {
    const sourceCreds = await getCredentials(sync.sourceConnection.kvKey)
    const targetCreds = await getCredentials(sync.targetConnection.kvKey)
    if (!sourceCreds || !targetCreds) throw new Error('Missing credentials for connection')

    const result = await executeTemplate(sync, sourceCreds, targetCreds)

    // Slot already reserved; record the records-processed counter.
    if (result.recordsOut > 0) await incrementUsage(sync.userId, 0, result.recordsOut, month)

    await prisma.syncLog.update({
      where: { id: logEntry.id },
      data: {
        status: result.status,
        recordsIn: result.recordsIn,
        recordsOut: result.recordsOut,
        errorMessage: result.errorMessage,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
      },
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
    await prisma.sync.update({
      where: { id: syncId },
      data: { lastRunStatus: 'FAILED', nextRunAt: calcNextRun(sync.schedule) },
    })
    return makeError(message, startedAt)
  }
}

async function executeTemplate(
  sync: Awaited<ReturnType<typeof prisma.sync.findUnique>> & {
    sourceConnection: { platform: string; kvKey: string }
    targetConnection: { platform: string; kvKey: string }
    user: { plan: any }
  },
  sourceCreds: Record<string, string>,
  targetCreds: Record<string, string>,
): Promise<SyncResult> {
  const templateId = sync!.templateId
  const start = Date.now()
  const mapping = (sync!.fieldMapping ?? {}) as Record<string, string>

  function done(c: PartialCounts, errSample?: string): SyncResult {
    return {
      status: finalStatus(c),
      recordsIn: c.recordsIn,
      recordsOut: c.recordsOut,
      errorMessage: c.errors > 0 ? `${c.errors} záznam(ů) selhalo${errSample ? `: ${errSample}` : ''}` : undefined,
      durationMs: Date.now() - start,
    }
  }

  if (templateId === 'shoptet-raynet-orders') {
    const shoptet = new ShoptetClient({ apiKey: sourceCreds.apiKey, eshopId: sourceCreds.eshopId })
    const raynet = new RaynetClient({ instanceName: targetCreds.instanceName, apiKey: targetCreds.apiKey, username: targetCreds.username })

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const orders = await shoptet.getOrders({ from: yesterday })
    const counts: PartialCounts = { recordsIn: orders.length, recordsOut: 0, errors: 0 }
    let lastError: string | undefined

    for (const order of orders) {
      try {
        const ico = order.billing.ico?.trim()
        let company = ico ? await raynet.findCompanyByIco(ico) : null
        if (!company && order.billing.company) {
          company = await raynet.createCompany({
            name: order.billing.company,
            ico,
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
        counts.recordsOut++
      } catch (e) {
        counts.errors++
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    return done(counts, lastError)
  }

  if (templateId === 'pohoda-raynet-faktury') {
    const pohoda = new PohodaClient({ url: sourceCreds.url, username: sourceCreds.username, password: sourceCreds.password, ico: sourceCreds.ico })
    const raynet = new RaynetClient({ instanceName: targetCreds.instanceName, apiKey: targetCreds.apiKey, username: targetCreds.username })

    const invoices = await pohoda.getInvoices({ dateFrom: utcDateDaysAgo(1) })
    const processable = invoices.filter(i => i.ico?.trim())
    const counts: PartialCounts = { recordsIn: processable.length, recordsOut: 0, errors: 0 }
    let lastError: string | undefined

    for (const inv of processable) {
      try {
        let company = await raynet.findCompanyByIco(inv.ico!)
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
          counts.recordsOut++
        }
      } catch (e) {
        counts.errors++
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    return done(counts, lastError)
  }

  if (templateId === 'packeta-shoptet-tracking') {
    const packeta = new PacketaClient({ apiKey: sourceCreds.apiKey, apiPassword: sourceCreds.apiPassword })
    const shoptet = new ShoptetClient({ apiKey: targetCreds.apiKey, eshopId: targetCreds.eshopId })

    const orders = await shoptet.getOrders({ status: 'dispatched' })
    const counts: PartialCounts = { recordsIn: orders.length, recordsOut: 0, errors: 0 }
    let lastError: string | undefined

    const STATUS_MAP: Record<string, string> = {
      received:         'received',
      accepted:         'accepted',
      preparing:        'preparing',
      ready_for_pickup: 'ready',
      dispatched:       'dispatched',
      delivered:        'delivered',
      returned:         'returned',
      cancelled:        'cancelled',
    }

    for (const order of orders) {
      try {
        const packet = await packeta.getPacketStatus(order.code)
        if (packet && STATUS_MAP[packet.status]) {
          await shoptet.updateOrderStatus(order.code, STATUS_MAP[packet.status])
          counts.recordsOut++
        }
      } catch (e) {
        counts.errors++
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    return done(counts, lastError)
  }

  if (templateId === 'shoptet-airtable-orders') {
    const shoptet = new ShoptetClient({ apiKey: sourceCreds.apiKey, eshopId: sourceCreds.eshopId })
    const airtable = new AirtableClient({ accessToken: targetCreds.accessToken, baseId: targetCreds.baseId })
    const tableId = mapping['_tableId'] ?? 'Objednávky'

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const orders = await shoptet.getOrders({ from: yesterday })
    const counts: PartialCounts = { recordsIn: orders.length, recordsOut: 0, errors: 0 }
    let lastError: string | undefined

    for (const order of orders) {
      try {
        if (!order.code?.trim()) {
          counts.errors++
          continue
        }
        await airtable.upsertByField(tableId, {
          'Číslo objednávky': order.code,
          'Firma':            order.billing.company ?? '',
          'IČO':              order.billing.ico ?? '',
          'Celková cena':     order.totalPriceWithVat,
          'Stav':             order.status ?? 'Nová',
          'Datum objednávky': order.creationTime ?? new Date().toISOString(),
          'Email':            order.email ?? '',
        }, 'Číslo objednávky')
        counts.recordsOut++
      } catch (e) {
        counts.errors++
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    return done(counts, lastError)
  }

  if (templateId === 'raynet-airtable-contacts') {
    const raynet = new RaynetClient({ instanceName: sourceCreds.instanceName, apiKey: sourceCreds.apiKey, username: sourceCreds.username })
    const airtable = new AirtableClient({ accessToken: targetCreds.accessToken, baseId: targetCreds.baseId })
    const tableId = mapping['_tableId'] ?? 'Kontakty'

    const companies = await raynet.getCompanies()
    const counts: PartialCounts = { recordsIn: companies.length, recordsOut: 0, errors: 0 }
    let lastError: string | undefined

    for (const company of companies) {
      try {
        await airtable.upsertByField(tableId, {
          'Název firmy': company.name,
          'IČO':         company.ico ?? '',
          'DIČ':         company.dic ?? '',
          'Email':       company.email ?? '',
          'Telefon':     company.phone ?? '',
        }, 'IČO') // empty IČO → upsertByField will createRecord instead of upsert
        counts.recordsOut++
      } catch (e) {
        counts.errors++
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    return done(counts, lastError)
  }

  if (templateId === 'pohoda-airtable-invoices') {
    const pohoda = new PohodaClient({ url: sourceCreds.url, username: sourceCreds.username, password: sourceCreds.password, ico: sourceCreds.ico })
    const airtable = new AirtableClient({ accessToken: targetCreds.accessToken, baseId: targetCreds.baseId })
    const tableId = mapping['_tableId'] ?? 'Faktury'

    const invoices = await pohoda.getInvoices({ dateFrom: utcDateDaysAgo(1) })
    const counts: PartialCounts = { recordsIn: invoices.length, recordsOut: 0, errors: 0 }
    let lastError: string | undefined

    for (const inv of invoices) {
      try {
        await airtable.upsertByField(tableId, {
          'Variabilní symbol':  inv.variabilniSymbol ?? '',
          'Firma':              inv.company ?? '',
          'IČO':                inv.ico ?? '',
          'DIČ':                inv.dic ?? '',
          'Celkem s DPH':       inv.amountWithVat,
          'Datum vystavení':    inv.date ?? '',
          'Datum splatnosti':   inv.dateDue ?? '',
        }, 'Variabilní symbol')
        counts.recordsOut++
      } catch (e) {
        counts.errors++
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    return done(counts, lastError)
  }

  if (templateId === 'packeta-airtable-shipments') {
    const packeta = new PacketaClient({ apiKey: sourceCreds.apiKey, apiPassword: sourceCreds.apiPassword })
    const airtable = new AirtableClient({ accessToken: targetCreds.accessToken, baseId: targetCreds.baseId })
    const tableId = mapping['_tableId'] ?? 'Zásilky'

    const existing = await airtable.listRecords(tableId)
    const counts: PartialCounts = { recordsIn: existing.records.length, recordsOut: 0, errors: 0 }
    let lastError: string | undefined

    for (const rec of existing.records) {
      try {
        const packetId = String(rec.fields['ID zásilky'] ?? '').trim()
        if (!packetId) continue
        const packet = await packeta.getPacketStatus(packetId)
        if (packet) {
          await airtable.updateRecord(tableId, rec.id!, {
            'Stav zásilky': packet.status,
            'Tracking URL': packet.trackingUrl ?? '',
          })
          counts.recordsOut++
        }
      } catch (e) {
        counts.errors++
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    return done(counts, lastError)
  }

  // Unknown template — refuse to silently report success
  throw new Error(`Šablona "${templateId ?? 'unknown'}" není podporována`)
}

function utcDateDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function calcNextRun(schedule: Schedule): Date | null {
  const nowMs = Date.now()
  switch (schedule) {
    case 'EVERY_5MIN':  return new Date(nowMs + 5 * 60 * 1000)
    case 'EVERY_HOUR':  return new Date(nowMs + 60 * 60 * 1000)
    case 'DAILY':       return new Date(nowMs + 24 * 60 * 60 * 1000)
    case 'WEEKLY':      return new Date(nowMs + 7 * 24 * 60 * 60 * 1000)
    default:            return null
  }
}

function makeError(message: string, startedAt: number): SyncResult {
  return { status: 'FAILED', recordsIn: 0, recordsOut: 0, errorMessage: message, durationMs: Date.now() - startedAt }
}
