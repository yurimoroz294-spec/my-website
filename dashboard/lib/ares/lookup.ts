// Czech public business registry – free, no API key needed
// Docs: https://ares.gov.cz/ekonomicke-subjekty-v-be/rest

const BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest'

export interface AresResult {
  ico: string
  companyName: string
  dic: string | null
  address: string | null
  city: string | null
  zip: string | null
  raw: Record<string, unknown>
}

export async function lookupByIco(ico: string): Promise<AresResult | null> {
  // IČO must be 8 digits (zero-padded)
  const normalized = ico.replace(/\s/g, '').padStart(8, '0')

  const res = await fetch(`${BASE}/ekonomicke-subjekty/${normalized}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 }, // cache 1h — company data rarely changes
  })

  if (res.status === 404) return null
  if (!res.ok) throw new Error(`ARES API error: ${res.status}`)

  const data = await res.json()

  // Parse address from ARES response structure
  const sidlo = data.sidlo ?? {}
  const addressParts = [
    sidlo.textovaAdresa,
    sidlo.nazevUlice && sidlo.cisloDomovni
      ? `${sidlo.nazevUlice} ${sidlo.cisloDomovni}${sidlo.cisloOrientacni ? `/${sidlo.cisloOrientacni}` : ''}`
      : null,
  ].filter(Boolean)

  return {
    ico: data.ico ?? normalized,
    companyName: data.obchodniJmeno ?? '',
    dic: data.dic ?? null,
    address: addressParts[0] ?? sidlo.textovaAdresa ?? null,
    city: sidlo.nazevObce ?? null,
    zip: sidlo.psc ? String(sidlo.psc) : null,
    raw: data,
  }
}

// Validate IČO checksum (Czech algorithm)
export function isValidIco(ico: string): boolean {
  const digits = ico.replace(/\s/g, '').padStart(8, '0')
  if (!/^\d{8}$/.test(digits)) return false
  const weights = [8, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, w, i) => acc + w * parseInt(digits[i]), 0)
  const rem = sum % 11
  const check = rem === 0 ? 1 : rem === 1 ? 0 : 11 - rem
  return check === parseInt(digits[7])
}
