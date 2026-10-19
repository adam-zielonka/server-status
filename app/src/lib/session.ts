import type { Session } from '@/types'

const KEY = 'server-status.session'
const LEGACY_KEY = 'beta_connection'

export function readSession(): Session | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || 'null',
    )
    if (
      !value ||
      typeof value !== 'object' ||
      !('user' in value) ||
      !('token' in value) ||
      typeof value.user !== 'string' ||
      typeof value.token !== 'string' ||
      !value.token
    )
      return null
    const session = { user: value.user, token: value.token }
    storeSession(session)
    return session
  } catch {
    return null
  }
}

export function storeSession(session: Session | null): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
    if (session)
      localStorage.setItem(KEY, JSON.stringify({ user: session.user, token: session.token }))
    else localStorage.removeItem(KEY)
  } catch {
    /* The app can still use an in-memory session when storage is blocked. */
  }
}
