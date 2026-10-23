import { describe, expect, it, vi } from 'vitest'
import { ApiError, authenticate, fetchEndpoint } from './api'
import { demoTelemetry } from './demo'

function mockResponse(body: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('typed API client', () => {
  it('uses only synthetic data in demo mode without making HTTP requests', async () => {
    vi.stubEnv('VITE_FAKE_API', 'true')
    vi.resetModules()
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    const demoApi = await import('./api')
    expect((await demoApi.fetchEndpoint('system', 'demo')).system.hostname).toBe('example-node')
    expect(await demoApi.authenticate('demo-user', 'test-only')).toEqual({
      user: 'demo-user',
      token: 'demo-session',
    })
    expect(network).not.toHaveBeenCalled()
  })
  it('sends bearer authentication, no-store and cancellation', async () => {
    const fetch = mockResponse({ data: 'ok' })
    const controller = new AbortController()
    expect(await fetchEndpoint('ok', 'test-token', controller.signal)).toBe('ok')
    expect(fetch).toHaveBeenCalledWith(
      '/api/ok',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token', Accept: 'application/json' },
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
    const signal = fetch.mock.calls[0][1].signal as AbortSignal
    controller.abort()
    expect(signal.aborted).toBe(true)
  })
  it('keeps a timeout when the query supplies its own cancellation signal', async () => {
    const timeout = new AbortController()
    const spy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }: RequestInit) =>
          new Promise((_resolve, reject) => {
            signal!.addEventListener('abort', () => reject(signal!.reason), { once: true })
          }),
      ),
    )
    try {
      const request = expect(
        fetchEndpoint('ok', 'test', new AbortController().signal),
      ).rejects.toThrow('Could not reach the server')
      timeout.abort(new DOMException('Timed out', 'TimeoutError'))
      await request
    } finally {
      spy.mockRestore()
    }
  })
  it('rejects malformed basic metrics before rendering them', async () => {
    for (const endpoint of [
      'system',
      'memory',
      'load-average',
      'net',
      'services',
      'vhosts',
      'file-system',
    ] as const) {
      mockResponse({ data: { unexpected: true } })
      await expect(fetchEndpoint(endpoint, 'test')).rejects.toThrow('invalid monitoring data')
    }
  })
  it('rejects invalid rows inside an otherwise supported snapshot', async () => {
    for (const key of [
      'services',
      'history',
      'jobs',
      'directories',
      'databases',
      'tunnels',
    ] as const) {
      mockResponse({ data: { ...demoTelemetry(), [key]: [null] } })
      await expect(fetchEndpoint('telemetry', 'test')).rejects.toThrow('not supported')
    }
    mockResponse({ data: { ...demoTelemetry(), tailscale: { services: [null] } } })
    await expect(fetchEndpoint('telemetry', 'test')).rejects.toThrow('not supported')
  })
  it('supports Unicode credentials without storing a password', async () => {
    const fetch = mockResponse({ data: { token: 'example-session' } })
    expect(await authenticate('example-user', 'pąssword')).toEqual({
      user: 'example-user',
      token: 'example-session',
    })
    const header = fetch.mock.calls[0][1].headers.Authorization as string
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(header.slice(6)), (char) => char.charCodeAt(0)),
    )
    expect(decoded).toBe('example-user:pąssword')
  })
  it('distinguishes an invalid login from an expired session', async () => {
    mockResponse({ errors: ['Invalid credentials'] }, 401)
    await expect(authenticate('example', 'wrong')).rejects.toThrow(
      'Incorrect username or password.',
    )
    await expect(fetchEndpoint('ok', 'expired')).rejects.toEqual(
      expect.objectContaining({ status: 401 }),
    )
  })
  it('normalizes empty Go slices and accepts a disabled collector', async () => {
    mockResponse({ data: null })
    expect(await fetchEndpoint('net', 'test')).toEqual([])
    mockResponse({ data: { enabled: false } })
    expect(await fetchEndpoint('telemetry', 'test')).toEqual({ enabled: false })
  })
  it('rejects unsupported or incomplete snapshots', async () => {
    mockResponse({ data: { enabled: true, schema_version: 2 } })
    await expect(fetchEndpoint('telemetry', 'test')).rejects.toThrow('not supported')
  })
  it('requires complete process and group rankings', async () => {
    const snapshot = demoTelemetry()
    mockResponse({ data: snapshot })
    expect(await fetchEndpoint('telemetry', 'test')).toEqual(snapshot)
    for (const field of ['top_cpu', 'top_memory', 'groups_cpu', 'groups_memory']) {
      mockResponse({ data: { ...snapshot, processes: { ...snapshot.processes, [field]: null } } })
      await expect(fetchEndpoint('telemetry', 'test')).rejects.toThrow('not supported')
    }
  })
  it('handles non-JSON responses without exposing their HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<html>private server details</html>', { status: 502 })),
    )
    await expect(fetchEndpoint('ok', 'test')).rejects.toThrow('invalid response')
  })
  it('reports network errors and does not replace cancellations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private upstream URL')))
    await expect(fetchEndpoint('ok', 'test')).rejects.toThrow('Could not reach the server')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    await expect(fetchEndpoint('ok', 'test')).rejects.toEqual(
      expect.objectContaining({ name: 'AbortError' }),
    )
  })
  it('rejects failed and incomplete responses', async () => {
    mockResponse({ errors: ['Temporarily unavailable'] }, 500)
    await expect(fetchEndpoint('ok', 'test')).rejects.toBeInstanceOf(ApiError)
    mockResponse({})
    await expect(fetchEndpoint('ok', 'test')).rejects.toThrow('incomplete')
    mockResponse({ data: {} })
    await expect(authenticate('example', 'test')).rejects.toThrow('valid session')
  })
})
