import OpenAI from 'openai'
import type { ExtractedInvoice } from '@/lib/supabase/types'
// pdf-parse uses CommonJS; dynamic import avoids build issues with App Router
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// System prompt specifically tuned for Czech invoices
const SYSTEM_PROMPT = `Jsi expert na české účetnictví. Tvým úkolem je extrahovat všechna data z české faktury.

DŮLEŽITÉ ČESKÉ POJMY:
- IČO (nebo IČ): identifikační číslo osoby, vždy 8 číslic (doplň nuly zleva)
- DIČ: daňové identifikační číslo, formát CZ + 8-10 číslic
- DUZP: datum uskutečnění zdanitelného plnění – POZOR: může se lišit od data vystavení faktury!
  Hledej: "Datum zdanitelného plnění", "DUZP", "Datum uskutečnění", "Datum dodání"
- DPH sazby v ČR: 21% (základní), 12% (snížená – potraviny, knihy od 2024), 0% (osvobozené)
- Variabilní symbol (VS): platební referenční číslo
- Konstantní symbol (KS): čtyřmístný kód
- Číslo účtu: český formát NNNNNN/BBBB (číslo účtu / kód banky), nebo IBAN

PRAVIDLA:
- Vrať POUZE validní JSON bez markdown bloků
- Pokud pole nelze najít, vrať null
- Datum vždy ve formátu YYYY-MM-DD
- Čísla bez mezer a bez měnového symbolu (jen číslo)
- IČO: přesně 8 číslic, bez mezer
- DIČ: vždy začíná "CZ"
- Číslo účtu: formát "123456789/0800" (bez mezer)
- currency: výchozí "CZK" pokud není uvedeno jinak`

const SCHEMA = {
  type: 'object',
  properties: {
    supplier_name:    { type: ['string', 'null'] },
    supplier_ico:     { type: ['string', 'null'], description: 'Přesně 8 číslic' },
    supplier_dic:     { type: ['string', 'null'], description: 'Formát CZxxxxxxxx' },
    supplier_address: { type: ['string', 'null'] },
    supplier_city:    { type: ['string', 'null'] },
    supplier_zip:     { type: ['string', 'null'] },
    invoice_number:   { type: ['string', 'null'] },
    invoice_date:     { type: ['string', 'null'], description: 'YYYY-MM-DD – datum vystavení' },
    duzp:             { type: ['string', 'null'], description: 'YYYY-MM-DD – datum uskutečnění zdanitelného plnění' },
    due_date:         { type: ['string', 'null'], description: 'YYYY-MM-DD – datum splatnosti' },
    currency:         { type: 'string', default: 'CZK' },
    amount_without_vat: { type: ['number', 'null'], description: 'Základ DPH celkem' },
    vat_amount:         { type: ['number', 'null'], description: 'DPH celkem' },
    amount_total:       { type: ['number', 'null'], description: 'Celková částka vč. DPH' },
    dph_lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rate:       { type: 'number', description: '21, 12 nebo 0' },
          base:       { type: 'number', description: 'Základ DPH pro tuto sazbu' },
          vat_amount: { type: 'number', description: 'Výše DPH pro tuto sazbu' },
        },
        required: ['rate', 'base', 'vat_amount'],
      },
    },
    variable_symbol:  { type: ['string', 'null'] },
    constant_symbol:  { type: ['string', 'null'] },
    specific_symbol:  { type: ['string', 'null'] },
    bank_account_cz:  { type: ['string', 'null'], description: 'Formát 123456789/0800' },
    iban:             { type: ['string', 'null'] },
    swift:            { type: ['string', 'null'] },
    payment_method:   { type: ['string', 'null'], description: 'prevod | hotovost | karta' },
  },
  required: [
    'supplier_name', 'supplier_ico', 'supplier_dic', 'invoice_number',
    'invoice_date', 'duzp', 'due_date', 'currency',
    'amount_without_vat', 'vat_amount', 'amount_total', 'dph_lines',
    'variable_symbol', 'bank_account_cz',
  ],
  additionalProperties: false,
}

export interface ExtractionResult {
  invoice: ExtractedInvoice
  model: string
  tokens: number
}

export async function extractFromPdf(pdfBuffer: Buffer): Promise<ExtractionResult> {
  const parsed = await pdfParse(pdfBuffer)
  const text = parsed.text?.trim()

  if (!text || text.length < 50) {
    throw new Error('PDF neobsahuje čitelný text. Zkuste naskenovat jako obrázek.')
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'
  const response = await client.chat.completions.create({
    model,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'czech_invoice', strict: true, schema: SCHEMA },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extrahuj všechna data z následující faktury:\n\n${text.slice(0, 12000)}`,
      },
    ],
    temperature: 0,
  })

  const raw = response.choices[0].message.content!
  const invoice = JSON.parse(raw) as ExtractedInvoice

  return {
    invoice,
    model,
    tokens: response.usage?.total_tokens ?? 0,
  }
}

export async function extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const base64 = imageBuffer.toString('base64')
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'

  const response = await client.chat.completions.create({
    model,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'czech_invoice', strict: true, schema: SCHEMA },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extrahuj všechna data z tohoto obrázku faktury:' },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
          },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 2000,
  })

  const raw = response.choices[0].message.content!
  const invoice = JSON.parse(raw) as ExtractedInvoice

  return {
    invoice,
    model,
    tokens: response.usage?.total_tokens ?? 0,
  }
}

export async function extractFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ExtractionResult> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return extractFromPdf(buffer)
  }

  if (['jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext)) {
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : 'image/tiff'
    return extractFromImage(buffer, mime)
  }

  if (ext === 'isdoc' || ext === 'isdocx') {
    // ISDOC is XML – extract text directly
    const text = buffer.toString('utf-8')
    return extractFromText(text)
  }

  throw new Error(`Nepodporovaný formát souboru: ${ext}`)
}

async function extractFromText(text: string): Promise<ExtractionResult> {
  const model = process.env.OPENAI_MODEL_MINI ?? 'gpt-4o-mini'
  const response = await client.chat.completions.create({
    model,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'czech_invoice', strict: true, schema: SCHEMA },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extrahuj data z tohoto XML dokumentu (ISDOC):\n\n${text.slice(0, 12000)}` },
    ],
    temperature: 0,
  })
  return {
    invoice: JSON.parse(response.choices[0].message.content!) as ExtractedInvoice,
    model,
    tokens: response.usage?.total_tokens ?? 0,
  }
}
