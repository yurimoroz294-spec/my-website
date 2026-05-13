import { isValidIco, isValidDic, isValidVariabilniSymbol, MOCK_SHOPTET_ORDER, MOCK_POHODA_INVOICE } from './mock-data'

describe('Czech-specific field validation', () => {
  describe('IČO validation', () => {
    it('accepts valid IČO', () => {
      expect(isValidIco('27082440')).toBe(true) // Czech Post IČO
      expect(isValidIco('45274649')).toBe(true) // ČEZ IČO
    })

    it('rejects invalid IČO', () => {
      expect(isValidIco('12345678')).toBe(false)
      expect(isValidIco('1234567')).toBe(false)   // too short
      expect(isValidIco('123456789')).toBe(false)  // too long
      expect(isValidIco('abcdefgh')).toBe(false)   // not digits
    })
  })

  describe('DIČ validation', () => {
    it('accepts valid DIČ', () => {
      expect(isValidDic('CZ27082440')).toBe(true)
      expect(isValidDic('CZ1234567890')).toBe(true)
    })

    it('rejects invalid DIČ', () => {
      expect(isValidDic('27082440')).toBe(false)     // missing CZ prefix
      expect(isValidDic('CZ1234567')).toBe(false)    // too short
      expect(isValidDic('DE27082440')).toBe(false)   // wrong country
    })
  })

  describe('Variabilní symbol validation', () => {
    it('accepts valid variabilní symbol', () => {
      expect(isValidVariabilniSymbol('2024001234')).toBe(true)
      expect(isValidVariabilniSymbol('1')).toBe(true)
      expect(isValidVariabilniSymbol('1234567890')).toBe(true)
    })

    it('rejects invalid variabilní symbol', () => {
      expect(isValidVariabilniSymbol('12345678901')).toBe(false) // > 10 digits
      expect(isValidVariabilniSymbol('VS-2024-001')).toBe(false) // non-numeric
    })
  })

  describe('Mock Shoptet order', () => {
    it('has valid Czech company fields', () => {
      const { billing } = MOCK_SHOPTET_ORDER
      expect(billing.ico).toBeTruthy()
      expect(billing.dic).toMatch(/^CZ\d{8,10}$/)
      expect(MOCK_SHOPTET_ORDER.variableSymbol).toMatch(/^\d{1,10}$/)
    })

    it('has CZK currency', () => {
      expect(MOCK_SHOPTET_ORDER.currency).toBe('CZK')
    })

    it('has valid DPH (VAT) rates on items', () => {
      const validVatRates = [0, 10, 12, 21]
      MOCK_SHOPTET_ORDER.items.forEach(item => {
        expect(validVatRates).toContain(item.vatRate)
      })
    })
  })

  describe('Mock Pohoda invoice', () => {
    it('has variabilní symbol', () => {
      expect(MOCK_POHODA_INVOICE.variabilniSymbol).toBeTruthy()
      expect(isValidVariabilniSymbol(MOCK_POHODA_INVOICE.variabilniSymbol)).toBe(true)
    })

    it('has valid date formats', () => {
      expect(MOCK_POHODA_INVOICE.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(MOCK_POHODA_INVOICE.dateDue).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('amountWithVat is higher than amount', () => {
      expect(MOCK_POHODA_INVOICE.amountWithVat).toBeGreaterThan(MOCK_POHODA_INVOICE.amount)
    })
  })
})
