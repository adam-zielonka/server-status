import type { Endpoint, EndpointMap, Session, Telemetry } from '@/types'

export const isDemo = import.meta.env.VITE_FAKE_API === 'true'
export const showVirtualHosts = import.meta.env.VITE_SHOW_VHOSTS !== 'false'
const baseUrl = (import.meta.env.VITE_API_URL || '/api/').replace(/\/?$/, '/')

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function validTelemetry(data: unknown): data is Telemetry {
  if (!data || typeof data !== 'object' || !('enabled' in data)) return false
  if (data.enabled === false) return true
  if (data.enabled !== true) return false
  const value = data as Record<string, unknown>
  return (
    value.schema_version === 1 &&
    typeof value.collected_at === 'string' &&
    ['services', 'directories', 'jobs', 'history'].every((key) => Array.isArray(value[key])) &&
    typeof value.container === 'object' &&
    value.container !== null &&
    typeof value.processes === 'object' &&
    value.processes !== null
  )
}

async function request(
  path: string,
  authorization: string,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(baseUrl + path, {
      method: 'GET',
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
      signal: signal ?? AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
      throw error
    throw new ApiError('Could not reach the server. Check your connection and try again.')
  }
  if (response.status === 401) throw new ApiError('Your session has expired. Sign in again.', 401)
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ApiError('The server returned an invalid response.', response.status)
  }
  if (!body || typeof body !== 'object')
    throw new ApiError('The server returned an invalid response.', response.status)
  const envelope = body as { data?: unknown; errors?: unknown }
  if (!response.ok || (Array.isArray(envelope.errors) && envelope.errors.length)) {
    const message = Array.isArray(envelope.errors)
      ? envelope.errors.filter((e): e is string => typeof e === 'string').join(', ')
      : ''
    throw new ApiError(message || 'This information is temporarily unavailable.', response.status)
  }
  if (!('data' in envelope))
    throw new ApiError('The server returned an incomplete response.', response.status)
  return envelope.data
}

export async function fetchEndpoint<K extends Endpoint>(
  endpoint: K,
  token: string,
  signal?: AbortSignal,
): Promise<EndpointMap[K]> {
  if (isDemo) return (await import('./demo')).demoEndpoint(endpoint)
  const data = await request(endpoint, `Bearer ${token}`, signal)
  if (endpoint === 'telemetry' && !validTelemetry(data))
    throw new ApiError(
      'This monitoring snapshot is not supported. Update the collector and try again.',
    )
  if (['services', 'net', 'file-system', 'vhosts'].includes(endpoint) && data === null)
    return [] as unknown as EndpointMap[K]
  return data as EndpointMap[K]
}

export async function authenticate(user: string, password: string): Promise<Session> {
  if (isDemo) return { user: user || 'demo', token: 'demo-session' }
  const bytes = new TextEncoder().encode(`${user}:${password}`)
  const basic = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
  let data: unknown
  try {
    data = await request('auth', `Basic ${basic}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      throw new ApiError('Incorrect username or password.', 401)
    throw error
  }
  if (
    !data ||
    typeof data !== 'object' ||
    !('token' in data) ||
    typeof data.token !== 'string' ||
    !data.token
  )
    throw new ApiError('The server did not return a valid session.')
  return { user, token: data.token }
}
