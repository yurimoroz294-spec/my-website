const hasClerk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')

export async function getAuthUserId(): Promise<string | null> {
  if (!hasClerk) return null
  try {
    const { auth } = await import('@clerk/nextjs/server')
    const { userId } = auth()
    return userId
  } catch {
    return null
  }
}
