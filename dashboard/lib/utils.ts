import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format CZK amount: 48350.50 → "48 350,50 Kč"
export function formatCZK(amount: number | null): string {
  if (amount === null) return '–'
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
  }).format(amount)
}

// Format Czech date: "2026-05-10" → "10. 05. 2026"
export function formatCzechDate(date: string | null): string {
  if (!date) return '–'
  return new Intl.DateTimeFormat('cs-CZ').format(new Date(date))
}

// Validate Czech IČO (8 digits, checksum)
export function validateIco(ico: string): boolean {
  const digits = ico.replace(/\s/g, '')
  if (!/^\d{8}$/.test(digits)) return false
  const weights = [8, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, w, i) => acc + w * parseInt(digits[i]), 0)
  const remainder = sum % 11
  const checkDigit = remainder === 0 ? 1 : remainder === 1 ? 0 : 11 - remainder
  return checkDigit === parseInt(digits[7])
}

// Validate Czech bank account format (123456789/0800)
export function validateCzechBankAccount(account: string): boolean {
  return /^(\d{0,6}-)?(\d{2,10})\/(\d{4})$/.test(account.trim())
}

// Extract bank code from account string
export function getBankName(account: string): string {
  const BANK_CODES: Record<string, string> = {
    '0100': 'Komerční banka',
    '0300': 'ČSOB',
    '0800': 'Česká spořitelna',
    '2010': 'Fio banka',
    '2060': 'Citfin',
    '2700': 'UniCredit Bank',
    '3030': 'Air Bank',
    '5500': 'Raiffeisenbank',
    '6210': 'mBank',
  }
  const code = account.split('/')[1]
  return BANK_CODES[code] ?? code
}
