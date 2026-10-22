import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { demoEndpoint, demoTelemetry } from '@/lib/demo'
import type { Endpoint } from '@/types'

vi.mock('@/features/dashboard/resource-history', () => ({
  default: () => <div role="img" aria-label="Resource history chart" />,
}))

const failures = new Set<string>()
let authExpired = false
let monitoringEnabled = true
let databaseMonitoring = false

function signedIn() {
  localStorage.setItem(
    'server-status.session',
    JSON.stringify({ user: 'example-user', token: 'test-session' }),
  )
}
function navigation() {
  return within(screen.getByRole('navigation', { name: 'Main navigation' }))
}

beforeEach(() => {
  failures.clear()
  authExpired = false
  monitoringEnabled = true
  databaseMonitoring = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      const endpoint = String(url).split('/').at(-1) || 'ok'
      if (authExpired)
        return new Response(JSON.stringify({ errors: ['Unauthorized'] }), { status: 401 })
      if (failures.has(endpoint))
        return new Response(JSON.stringify({ errors: ['Source unavailable'] }), { status: 500 })
      if (endpoint === 'auth')
        return new Response(JSON.stringify({ data: { token: 'test-session' } }))
      if (endpoint === 'telemetry') {
        const telemetry = demoTelemetry()
        if (databaseMonitoring)
          telemetry.databases = [
            {
              name: 'Example shared database',
              status: 'healthy',
              checked_at: new Date().toISOString(),
              limit_bytes: 200_000_000,
              bytes: 8_000_000,
              available_bytes: 192_000_000,
              used_percent: 4,
              connections: 2,
              tls: true,
              latency_ms: 30,
            },
          ]
        return new Response(
          JSON.stringify({ data: monitoringEnabled ? telemetry : { enabled: false } }),
        )
      }
      return new Response(JSON.stringify({ data: demoEndpoint(endpoint as Endpoint) }))
    }),
  )
})

describe('authentication flow', () => {
  it('signs in with the form and clears stored data on sign out', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    await user.type(screen.getByLabelText('Username'), 'example-user')
    await user.type(screen.getByLabelText('Password'), 'test-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Server overview' })).toBeInTheDocument()
    expect(localStorage.getItem('server-status.session')).toContain('test-session')
    expect(localStorage.getItem('server-status.session')).not.toContain('test-password')
    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0])
    expect(await screen.findByLabelText('Username')).toBeInTheDocument()
    expect(localStorage.getItem('server-status.session')).toBeNull()
    expect(screen.queryByText('example-node')).not.toBeInTheDocument()
  })
  it('shows a login error and permits retry', async () => {
    const user = userEvent.setup()
    authExpired = true
    render(<App />)
    await user.type(screen.getByLabelText('Username'), 'example-user')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(localStorage.getItem('server-status.session')).toBeNull()
  })
  it('expires an existing session after the API rejects it', async () => {
    signedIn()
    authExpired = true
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('session has expired')
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(localStorage.getItem('server-status.session')).toBeNull()
  })
})

describe('dashboard features', () => {
  it('navigates through all views and keeps system metrics accessible', async () => {
    const user = userEvent.setup()
    signedIn()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Server overview' })).toBeInTheDocument()
    await user.click(navigation().getByRole('link', { name: 'Services' }))
    expect(await screen.findByText('System services')).toBeInTheDocument()
    expect(await screen.findByText('Port availability')).toBeInTheDocument()
    await user.click(navigation().getByRole('link', { name: 'Storage' }))
    expect(await screen.findByText('Directory growth')).toBeInTheDocument()
    expect(await screen.findByText('Application data')).toBeInTheDocument()
    await user.click(navigation().getByRole('link', { name: 'Network' }))
    expect(await screen.findByText('Network interfaces')).toBeInTheDocument()
    expect(await screen.findByText('example-node.example.ts.net')).toBeInTheDocument()
    expect(await screen.findByText('192.0.2.10/24')).toBeInTheDocument()
    await user.click(navigation().getByRole('link', { name: 'System' }))
    expect(await screen.findByText('Container & allocation')).toBeInTheDocument()
    expect(await screen.findByText('Memory breakdown')).toBeInTheDocument()
    expect(await screen.findByText('Load average')).toBeInTheDocument()
    await user.click(navigation().getByRole('link', { name: 'Tasks & backups' }))
    expect(await screen.findByText('Application backup')).toBeInTheDocument()
    expect(window.location.hash).toBe('#tasks')
  })
  it('filters processes and switches between CPU and memory sorting', async () => {
    const user = userEvent.setup()
    signedIn()
    window.history.replaceState(null, '', '#processes')
    render(<App />)
    const filter = await screen.findByRole('textbox', { name: 'Search processes' })
    await user.type(filter, 'example-worker')
    expect(screen.getByText('example-worker')).toBeInTheDocument()
    expect(screen.queryByText('example-web')).not.toBeInTheDocument()
    await user.clear(filter)
    await user.click(screen.getByRole('tab', { name: 'CPU' }))
    expect(screen.getByRole('tab', { name: 'CPU' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('example-web')).toBeInTheDocument()
    await user.type(filter, 'no-matching-process')
    expect(screen.getByText('No matching processes')).toBeInTheDocument()
  })
  it('filters systemd services', async () => {
    const user = userEvent.setup()
    signedIn()
    window.history.replaceState(null, '', '#services')
    render(<App />)
    await user.type(await screen.findByRole('textbox', { name: 'Search services' }), 'example-0')
    expect(screen.getByText('example-0.service · system')).toBeInTheDocument()
    expect(screen.queryByText('example-1.service · system')).not.toBeInTheDocument()
  })
  it('preserves the basic dashboard when the optional collector is disabled', async () => {
    const user = userEvent.setup()
    signedIn()
    monitoringEnabled = false
    render(<App />)
    expect(await screen.findByText('Basic monitoring')).toBeInTheDocument()
    await user.click(navigation().getByRole('link', { name: 'Processes' }))
    expect(await screen.findByText('Process monitoring is not enabled')).toBeInTheDocument()
    await user.click(navigation().getByRole('link', { name: 'System' }))
    expect(await screen.findByText('Ubuntu 24.04')).toBeInTheDocument()
  })
  it('shows telemetry failures without hiding basic information', async () => {
    signedIn()
    failures.add('telemetry')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Source unavailable'), {
      timeout: 4000,
    })
    expect(screen.getByText('System at a glance')).toBeInTheDocument()
    expect(screen.getByText('Ubuntu 24.04')).toBeInTheDocument()
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
  })
  it('clears dashboard data when a refresh reports an expired session', async () => {
    const user = userEvent.setup()
    signedIn()
    render(<App />)
    await screen.findByRole('heading', { name: 'Server overview' })
    const refresh = screen.getByRole('button', { name: 'Refresh all metrics' })
    await waitFor(() => expect(refresh).toBeEnabled())
    authExpired = true
    await user.click(refresh)
    expect(await screen.findByLabelText('Username')).toBeInTheDocument()
    expect(localStorage.getItem('server-status.session')).toBeNull()
  })
  it('switches theme without affecting the authenticated session', async () => {
    const user = userEvent.setup()
    signedIn()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Use dark theme' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('server-status.theme')).toBe('dark')
    expect(localStorage.getItem('server-status.session')).toContain('test-session')
  })
})

describe('database monitoring', () => {
  it('shows decimal database capacity, TLS and availability in Storage', async () => {
    databaseMonitoring = true
    signedIn()
    window.location.hash = '#storage'
    render(<App />)
    expect(await screen.findByText('Example shared database')).toBeInTheDocument()
    expect(screen.getByText('8 MB / 200 MB')).toBeInTheDocument()
    expect(screen.getByText('192 MB')).toBeInTheDocument()
    expect(screen.getByText('TLS / 30 ms')).toBeInTheDocument()
  })
})
