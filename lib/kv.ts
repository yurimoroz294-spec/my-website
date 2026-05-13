import { kv } from '@vercel/kv'
import { encrypt, decrypt } from './encryption'

const KEY_PREFIX = 'conn:'

export async function storeCredentials(kvKey: string, credentials: Record<string, string>): Promise<void> {
  const encrypted = encrypt(JSON.stringify(credentials))
  await kv.set(`${KEY_PREFIX}${kvKey}`, encrypted, { ex: 60 * 60 * 24 * 365 })
}

export async function getCredentials(kvKey: string): Promise<Record<string, string> | null> {
  const encrypted = await kv.get<string>(`${KEY_PREFIX}${kvKey}`)
  if (!encrypted) return null
  return JSON.parse(decrypt(encrypted))
}

export async function deleteCredentials(kvKey: string): Promise<void> {
  await kv.del(`${KEY_PREFIX}${kvKey}`)
}
