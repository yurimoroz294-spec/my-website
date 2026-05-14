import type { Invoice } from '@prisma/client'
import { prisma } from './db/prisma'
import { getCredentials } from './kv'
import { PohodaClient, type PohodaCredentials } from './integrations/pohoda'
import { RaynetClient, type RaynetCredentials } from './integrations/raynet'
import { AirtableClient, type AirtableCredentials } from './integrations/airtable'

// Airtable table name used for all invoice imports
const AIRTABLE_INVOICE_TABLE = 'Faktury'

export async function sendInvoiceToTarget(invoiceId: string, userId: string): Promise<void> {
  const [invoice, user] = await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoiceId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { invoiceTargetPlatform: true },
    }),
  ])

  if (!invoice || !user) return

  const platform = user.invoiceTargetPlatform
  if (!platform) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'FAILED',
        errorMessage: 'Není nastaven cílový systém. Vyberte ho v záložce Faktury → Nastavení.',
      },
    })
    return
  }

  const connection = await prisma.connection.findFirst({
    where: { userId, platform, isActive: true },
  })
  if (!connection) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'FAILED',
        errorMessage: `Nemáte aktivní propojení pro ${platform}. Přidejte ho v záložce Propojení.`,
      },
    })
    return
  }

  const creds = await getCredentials(connection.kvKey)
  if (!creds) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'FAILED', errorMessage: 'Nepodařilo se načíst přihlašovací údaje.' },
    })
    return
  }

  try {
    switch (platform) {
      case 'POHODA':
        await routeToPohoda(invoice, creds as unknown as PohodaCredentials)
        break
      case 'RAYNET':
        await routeToRaynet(invoice, creds as unknown as RaynetCredentials)
        break
      case 'AIRTABLE':
        await routeToAirtable(invoice, creds as unknown as AirtableCredentials)
        break
      default:
        throw new Error(`Platforma ${platform} nepodporuje příjem faktur.`)
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'FAILED', errorMessage: `${platform} chyba: ${msg}` },
    })
    throw e
  }
}

function validateRequired(invoice: Invoice) {
  if (!invoice.variabilniSymbol) throw new Error('Chybí variabilní symbol.')
  if (!invoice.date) throw new Error('Chybí datum vystavení.')
  if (!invoice.dateDue) throw new Error('Chybí datum splatnosti.')
  if (invoice.amount == null) throw new Error('Chybí částka bez DPH.')
  if (invoice.amountWithVat == null) throw new Error('Chybí částka s DPH.')
}

async function routeToPohoda(invoice: Invoice, creds: PohodaCredentials) {
  validateRequired(invoice)
  const client = new PohodaClient(creds)
  await client.createInvoice({
    variabilniSymbol: invoice.variabilniSymbol!,
    ico: invoice.ico ?? undefined,
    dic: invoice.dic ?? undefined,
    company: invoice.company ?? undefined,
    date: invoice.date!,
    dateDue: invoice.dateDue!,
    amount: invoice.amount!,
    amountWithVat: invoice.amountWithVat!,
    vatRate: invoice.vatRate ?? 21,
    currency: invoice.currency ?? 'CZK',
    items: (invoice.items as any[]) ?? [],
  })
}

async function routeToRaynet(invoice: Invoice, creds: RaynetCredentials) {
  if (!invoice.variabilniSymbol) throw new Error('Chybí variabilní symbol.')
  if (invoice.amountWithVat == null) throw new Error('Chybí částka s DPH.')
  if (!invoice.dateDue) throw new Error('Chybí datum splatnosti.')

  const client = new RaynetClient(creds)

  // Find or create company by IČO
  let companyId: number | null = null
  if (invoice.ico?.trim()) {
    const existing = await client.findCompanyByIco(invoice.ico.trim())
    if (existing) {
      companyId = existing.id
    } else {
      const created = await client.createCompany({
        name: invoice.company ?? invoice.ico,
        ico: invoice.ico,
        dic: invoice.dic ?? undefined,
      })
      companyId = created.id
    }
  }

  if (!companyId) throw new Error('Faktura nemá IČO — nelze spárovat s firmou v RAYNET.')

  await client.createInvoice({
    companyId,
    amount: invoice.amountWithVat,
    variabilniSymbol: invoice.variabilniSymbol,
    dphRate: invoice.vatRate ?? 21,
    dueDate: invoice.dateDue,
  })
}

async function routeToAirtable(invoice: Invoice, creds: AirtableCredentials) {
  const client = new AirtableClient(creds)

  const fields: Record<string, unknown> = {}
  if (invoice.variabilniSymbol) fields['Variabilní symbol'] = invoice.variabilniSymbol
  if (invoice.company) fields['Firma'] = invoice.company
  if (invoice.ico) fields['IČO'] = invoice.ico
  if (invoice.dic) fields['DIČ'] = invoice.dic
  if (invoice.amountWithVat != null) fields['Celkem s DPH'] = invoice.amountWithVat
  if (invoice.amount != null) fields['Celkem bez DPH'] = invoice.amount
  if (invoice.vatRate != null) fields['Sazba DPH (%)'] = invoice.vatRate
  if (invoice.currency) fields['Měna'] = invoice.currency
  if (invoice.date) fields['Datum vystavení'] = invoice.date
  if (invoice.dateDue) fields['Datum splatnosti'] = invoice.dateDue
  if (invoice.fromEmail) fields['Odesílatel'] = invoice.fromEmail
  if (invoice.fileName) fields['Soubor'] = invoice.fileName

  // Upsert by variable symbol to avoid duplicates on re-send
  const matchField = invoice.variabilniSymbol ? 'Variabilní symbol' : ''
  if (matchField) {
    await client.upsertByField(AIRTABLE_INVOICE_TABLE, fields, matchField)
  } else {
    await client.createRecord(AIRTABLE_INVOICE_TABLE, fields)
  }
}
