import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface FieldMapping {
  sourceField: string
  targetField: string
  transform?: string   // optional transformation hint
  confidence: number   // 0-1
}

export async function suggestFieldMapping(
  sourceFields: string[],
  targetFields: string[],
  sourcePlatform: string,
  targetPlatform: string
): Promise<FieldMapping[]> {
  const prompt = `Jsi expert na mapování datových polí mezi Czech B2B platformami.

Source platform: ${sourcePlatform}
Source fields: ${sourceFields.join(', ')}

Target platform: ${targetPlatform}
Target fields: ${targetFields.join(', ')}

Czech-specific fields to handle: IČO, DIČ, variabilní symbol, DPH (VAT rate), cena s DPH, cena bez DPH.

Return JSON array of mappings:
[{"sourceField": "...", "targetField": "...", "transform": "optional note", "confidence": 0.0-1.0}]

Map only fields with confidence > 0.5. Return ONLY valid JSON, no explanation.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  try {
    const raw = response.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw)
    const mappings: FieldMapping[] = Array.isArray(parsed) ? parsed : (parsed.mappings ?? [])
    return mappings.filter(m => m.confidence >= 0.5)
  } catch {
    return []
  }
}

export interface ParsedInvoice {
  variabilniSymbol?: string
  ico?: string
  dic?: string
  company?: string
  amount?: number
  amountWithVat?: number
  vatRate?: number
  currency?: string
  date?: string
  dateDue?: string
  items?: Array<{
    description: string
    quantity: number
    unitPrice: number
    vatRate: number
  }>
}

export async function parseInvoiceText(text: string): Promise<ParsedInvoice> {
  const prompt = `Extrahuj data z české faktury. Vrať JSON s těmito poli (pokud jsou dostupná):
- variabilniSymbol (variabilní symbol pro platbu)
- ico (IČO odběratele)
- dic (DIČ odběratele, formát CZ + 8-10 číslic)
- company (název firmy)
- amount (částka bez DPH, číslo)
- amountWithVat (částka s DPH, číslo)
- vatRate (sazba DPH: 0, 10, 12, 21)
- currency (měna, default "CZK")
- date (datum vystavení, formát YYYY-MM-DD)
- dateDue (datum splatnosti, formát YYYY-MM-DD)
- items (pole položek faktury)

Text faktury:
${text.slice(0, 3000)}

Vrať POUZE platný JSON objekt.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0,
  })

  try {
    return JSON.parse(response.choices[0].message.content ?? '{}')
  } catch {
    return {}
  }
}

export async function parseInvoiceFromBase64(base64Image: string, mimeType = 'image/jpeg'): Promise<ParsedInvoice> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extrahuj všechna data z této české faktury. Vrať JSON s poli: variabilniSymbol, ico, dic, company, amount, amountWithVat, vatRate, currency, date (YYYY-MM-DD), dateDue (YYYY-MM-DD), items. Vrať POUZE platný JSON.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  })

  try {
    return JSON.parse(response.choices[0].message.content ?? '{}')
  } catch {
    return {}
  }
}
