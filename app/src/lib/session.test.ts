import { describe, expect, it, vi } from 'vitest'
import { readSession, storeSession } from './session'

describe('session storage', () => {
  it('migrates existing sessions and drops unrelated fields', () => {
    localStorage.setItem(
      'beta_connection',
      JSON.stringify({ user: 'example-user', token: 'test-token', pass: 'must-not-persist' }),
    )
    expect(readSession()).toEqual({ user: 'example-user', token: 'test-token' })
    expect(localStorage.getItem('beta_connection')).toBeNull()
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
  it('clears both current and legacy sessions on logout', () => {
    storeSession({ user: 'example', token: 'test-token' })
    localStorage.setItem('beta_connection', '{}')
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
