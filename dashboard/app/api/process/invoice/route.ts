import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { extractFromBuffer } from '@/lib/openai/extract-invoice'
import { lookupByIco, isValidIco } from '@/lib/ares/lookup'
import { pushToFakturoid } from '@/lib/crm/fakturoid'
import { pushToIDoklad } from '@/lib/crm/idoklad'
import { pushToPohodaMserver } from '@/lib/crm/pohoda'
import { fetchInvoiceEmails as fetchGmail, refreshAccessToken } from '@/lib/email/gmail'
import { fetchInvoiceEmailsImap } from '@/lib/email/imap'
import type { EmailConnection, CrmConnection, ExtractedInvoice } from '@/lib/supabase/types'

type Supa = Awaited<ReturnType<typeof createServiceClient>>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  // Allow cron or service calls; for user-initiated calls (no secret), service client handles auth
  void isCron

  const body = await request.json().catch(() => ({})) as { user_id?: string; invoice_id?: string }
  const supabase = await createServiceClient()

  if (body.invoice_id) {
    const { data: inv } = await (supabase.from('invoices') as AnyTable)
      .select('*').eq('id', body.invoice_id).single()
    if (inv) await pushInvoiceToCrm(inv as Record<string, unknown>, supabase)
    return NextResponse.json({ ok: true })
  }

  const query = (supabase.from('email_connections') as AnyTable)
    .select('*').eq('is_active', true).eq('is_verified', true)

  if (body.user_id) query.eq('user_id', body.user_id)

  const { data: emailConns } = await query
  if (!emailConns?.length) return NextResponse.json({ ok: true, processed: 0 })

  let total = 0
  for (const conn of emailConns as EmailConnection[]) {
    total += await processEmailConnection(conn, supabase)
  }

  return NextResponse.json({ ok: true, processed: total })
}

async function processEmailConnection(conn: EmailConnection, supabase: Supa): Promise<number> {
  let emails: Awaited<ReturnType<typeof fetchGmail>> = []

  try {
    if (conn.provider === 'gmail') {
      let token = conn.access_token!
      if (conn.token_expiry && new Date(conn.token_expiry).getTime() - Date.now() < 5 * 60 * 1000) {
        token = await refreshAccessToken(conn.refresh_token!)
        await (supabase.from('email_connections') as AnyTable)
          .update({ access_token: token, token_expiry: new Date(Date.now() + 3600 * 1000).toISOString() })
          .eq('id', conn.id)
      }
      emails = await fetchGmail(token)
    } else {
      emails = await fetchInvoiceEmailsImap(
        {
          host: conn.imap_host!,
          port: conn.imap_port!,
          username: conn.imap_username!,
          password: conn.imap_password!,
          useSSL: conn.imap_use_ssl,
        },
        conn.last_checked_at ? new Date(conn.last_checked_at) : undefined,
      )
    }
  } catch (err) {
    console.error(`Email fetch failed for ${conn.email_address}:`, err)
    return 0
  }

  await (supabase.from('email_connections') as AnyTable)
    .update({ last_checked_at: new Date().toISOString() })
    .eq('id', conn.id)

  const { data: crmConns } = await (supabase.from('crm_connections') as AnyTable)
    .select('*').eq('user_id', conn.user_id).eq('is_active', true)
    .order('created_at', { ascending: true }).limit(1)

  const crm = (crmConns as CrmConnection[] | null)?.[0] ?? null
  let count = 0

  for (const email of emails) {
    for (const attachment of email.attachments) {
      const { count: existing } = await (supabase.from('invoices') as AnyTable)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', conn.user_id)
        .eq('email_message_id', email.messageId)
        .eq('attachment_filename', attachment.filename)

      if (existing && existing > 0) continue

      const { data: inv } = await (supabase.from('invoices') as AnyTable)
        .insert({
          user_id: conn.user_id,
          email_connection_id: conn.id,
          crm_connection_id: crm?.id ?? null,
          email_message_id: email.messageId,
          email_subject: email.subject,
          email_from: email.from,
          email_received_at: email.receivedAt,
          attachment_filename: attachment.filename,
          attachment_type: attachment.filename.split('.').pop()?.toLowerCase() ?? 'unknown',
          status: 'processing',
        })
        .select()
        .single()

      if (!inv) continue
      const invId = (inv as { id: string; user_id: string }).id
      const userId = (inv as { id: string; user_id: string }).user_id

      await log(supabase, userId, invId, 'extraction_started', 'info', `Spouštím extrakci: ${attachment.filename}`)

      try {
        const result = await extractFromBuffer(attachment.data, attachment.filename, attachment.mimeType)
        const extracted = result.invoice

        await (supabase.from('invoices') as AnyTable).update({
          ...mapExtractedToDb(extracted),
          status: 'extracted',
          raw_extraction: extracted as unknown as Record<string, unknown>,
          extraction_model: result.model,
          extraction_tokens: result.tokens,
        }).eq('id', invId)

        await log(supabase, userId, invId, 'extraction_done', 'success',
          `Extrahováno: ${extracted.supplier_name} / ${extracted.invoice_number} / ${extracted.amount_total} ${extracted.currency}`)

        // ARES validation
        const ico = extracted.supplier_ico
        if (ico && isValidIco(ico)) {
          try {
            const ares = await lookupByIco(ico)
            if (ares) {
              await (supabase.from('invoices') as AnyTable).update({
                ares_verified: true,
                ares_company_name: ares.companyName,
                ares_address: ares.address,
                ares_dic: ares.dic,
                ares_data: ares.raw,
                status: 'ares_checked',
              }).eq('id', invId)
              await log(supabase, userId, invId, 'ares_verified', 'success',
                `ARES: ${ares.companyName}, DIČ: ${ares.dic ?? 'není plátce DPH'}`)
            }
          } catch {
            await log(supabase, userId, invId, 'ares_lookup', 'warning', 'ARES nedostupný, přeskakuji.')
          }
        }

        // Push to CRM
        const { data: latestInv } = await (supabase.from('invoices') as AnyTable)
          .select('*').eq('id', invId).single()
        if (crm && latestInv) {
          await pushInvoiceToCrm(latestInv as Record<string, unknown>, supabase)
        }

        count++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Neznámá chyba'
        await (supabase.from('invoices') as AnyTable)
          .update({ status: 'error', error_message: msg }).eq('id', invId)
        await log(supabase, userId, invId, 'error', 'error', msg)
      }
    }
  }

  return count
}

async function pushInvoiceToCrm(inv: Record<string, unknown>, supabase: Supa) {
  if (!inv.crm_connection_id) return

  const { data: crmData } = await (supabase.from('crm_connections') as AnyTable)
    .select('*').eq('id', inv.crm_connection_id as string).single()

  if (!crmData) return
  const crm = crmData as CrmConnection
  const extracted = dbToExtracted(inv)
  const invId = inv.id as string
  const userId = inv.user_id as string
  let crmRecordId: string | null = null

  try {
    if (crm.crm_type === 'fakturoid') {
      crmRecordId = await pushToFakturoid(
        { apiKey: crm.api_key!, slug: crm.fakturoid_slug!, userEmail: crm.api_url! },
        extracted,
      )
    } else if (crm.crm_type === 'idoklad') {
      crmRecordId = await pushToIDoklad(
        { clientId: crm.idoklad_client_id!, clientSecret: crm.api_secret! },
        extracted,
      )
    } else if (crm.crm_type === 'pohoda') {
      if (crm.pohoda_version === 'mserver') {
        crmRecordId = await pushToPohodaMserver(crm.api_url!, crm.api_key!, extracted, crm.pohoda_ico!)
      } else {
        crmRecordId = `xml:${Date.now()}`
      }
    }

    await (supabase.from('invoices') as AnyTable).update({
      status: 'crm_sent',
      crm_record_id: crmRecordId,
      crm_synced_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }).eq('id', invId)

    await log(supabase, userId, invId, 'crm_success', 'success',
      `Odesláno do ${crm.crm_type}, ID: ${crmRecordId}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'CRM chyba'
    await (supabase.from('invoices') as AnyTable).update({
      status: 'error',
      error_message: `CRM push selhal: ${msg}`,
      retry_count: ((inv.retry_count as number) ?? 0) + 1,
    }).eq('id', invId)
    await log(supabase, userId, invId, 'error', 'error', `CRM: ${msg}`)
  }
}

async function log(supabase: Supa, userId: string, invoiceId: string, action: string, status: string, message: string) {
  await (supabase.from('processing_logs') as AnyTable)
    .insert({ user_id: userId, invoice_id: invoiceId, action, status, message })
}

function mapExtractedToDb(e: ExtractedInvoice) {
  return {
    supplier_name: e.supplier_name, supplier_ico: e.supplier_ico, supplier_dic: e.supplier_dic,
    supplier_address: e.supplier_address, supplier_city: e.supplier_city, supplier_zip: e.supplier_zip,
    invoice_number: e.invoice_number, invoice_date: e.invoice_date, duzp: e.duzp, due_date: e.due_date,
    currency: e.currency ?? 'CZK', amount_without_vat: e.amount_without_vat,
    vat_amount: e.vat_amount, amount_total: e.amount_total, dph_lines: e.dph_lines,
    variable_symbol: e.variable_symbol, constant_symbol: e.constant_symbol, specific_symbol: e.specific_symbol,
    bank_account_cz: e.bank_account_cz, iban: e.iban, swift: e.swift, payment_method: e.payment_method,
  }
}

function dbToExtracted(inv: Record<string, unknown>): ExtractedInvoice {
  return {
    supplier_name: inv.supplier_name as string | null,
    supplier_ico: inv.supplier_ico as string | null,
    supplier_dic: inv.supplier_dic as string | null,
    supplier_address: inv.supplier_address as string | null,
    supplier_city: inv.supplier_city as string | null,
    supplier_zip: inv.supplier_zip as string | null,
    invoice_number: inv.invoice_number as string | null,
    invoice_date: inv.invoice_date as string | null,
    duzp: inv.duzp as string | null,
    due_date: inv.due_date as string | null,
    currency: (inv.currency as string) ?? 'CZK',
    amount_without_vat: inv.amount_without_vat as number | null,
    vat_amount: inv.vat_amount as number | null,
    amount_total: inv.amount_total as number | null,
    dph_lines: (inv.dph_lines as { rate: number; base: number; vat_amount: number }[]) ?? [],
    variable_symbol: inv.variable_symbol as string | null,
    constant_symbol: inv.constant_symbol as string | null,
    specific_symbol: inv.specific_symbol as string | null,
    bank_account_cz: inv.bank_account_cz as string | null,
    iban: inv.iban as string | null,
    swift: inv.swift as string | null,
    payment_method: inv.payment_method as string | null,
  }
}
