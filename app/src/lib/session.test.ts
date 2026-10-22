import { describe, expect, it, vi } from 'vitest'
import { readSession, storeSession } from './session'

describe('session storage', () => {
  it('persists only the username and token', () => {
    const session = { user: 'example-user', token: 'test-token', pass: 'must-not-persist' }
    storeSession(session)
    expect(readSession()).toEqual({ user: 'example-user', token: 'test-token' })
    expect(localStorage.getItem('server-status.session')).not.toContain('must-not-persist')
  })
  it.each([
    'broken-json',
    'null',
    '{}',
    '{"user":3,"token":"test"}',
    '{"user":"example","token":""}',
  ])('handles invalid stored data: %s', (value) => {
    localStorage.setItem('server-status.session', value)
    expect(readSession()).toBeNull()
  })
  it('clears the session on logout', () => {
    storeSession({ user: 'example', token: 'test-token' })
    storeSession(null)
    expect(localStorage.length).toBe(0)
  })
  it('keeps working if browser storage is denied', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked')
    })
    expect(readSession()).toBeNull()
    get.mockRestore()
  })
})
