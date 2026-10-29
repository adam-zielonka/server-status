import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { demoEndpoint, demoTelemetry } from '@/lib/demo'
import type { Endpoint, TelemetrySnapshot } from '@/types'

vi.mock('@/features/dashboard/resource-history', () => ({
  default: () => {
    if (chartFailure) throw new Error('Synthetic render failure')
    return <div role="img" aria-label="Resource history chart" />
  },
}))

const failures = new Set<string>()
let authExpired = false
let monitoringEnabled = true
let databaseMonitoring = false
let chartFailure = false
let updateSnapshot: (snapshot: TelemetrySnapshot) => void = () => {}

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
  chartFailure = false
  updateSnapshot = () => {}
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
        updateSnapshot(telemetry)
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
  it('does not show all systems operational when an active basic metric source fails', async () => {
    signedIn()
    failures.add('memory')
    render(<App />)
    await waitFor(() => expect(screen.getByText('Needs attention')).toBeInTheDocument(), {
      timeout: 4000,
    })
    expect(screen.queryByText('All systems operational')).not.toBeInTheDocument()
    expect(screen.getByText('System at a glance')).toBeInTheDocument()
  })
  it('shows a recovery action if rendering or a lazy component fails', async () => {
    chartFailure = true
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      signedIn()
      render(<App />)
      expect(
        await screen.findByRole('heading', { name: 'Could not load the dashboard' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
      expect(localStorage.getItem('server-status.session')).toContain('test-session')
    } finally {
      errors.mockRestore()
    }
  })
  it('restores views with browser Back and Forward, and keeps skip links on the current view', async () => {
    const user = userEvent.setup()
    signedIn()
    render(<App />)
    await screen.findByRole('heading', { name: 'Server overview' })
    await user.click(navigation().getByRole('link', { name: 'Services' }))
    await user.click(navigation().getByRole('link', { name: 'Storage' }))
    window.history.back()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Services', level: 1 })).toBeInTheDocument(),
    )
    window.history.forward()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Storage', level: 1 })).toBeInTheDocument(),
    )
    expect(document.title).toBe('Storage · Server Status')
    await user.click(screen.getByRole('link', { name: 'Skip to content' }))
    await waitFor(() => expect(window.location.hash).toBe('#main-content'))
    expect(screen.getByRole('heading', { name: 'Storage', level: 1 })).toBeInTheDocument()
  })
  it('prioritizes issues, expands the list and opens the related diagnostic view', async () => {
    updateSnapshot = (snapshot) => {
      snapshot.services.forEach((service) => {
        service.state = 'failed'
      })
      snapshot.jobs[0].status = 'failure'
    }
    const user = userEvent.setup()
    signedIn()
    render(<App />)
    const issues = await screen.findByRole('region', { name: 'Monitoring issues' })
    expect(within(issues).getAllByRole('link')).toHaveLength(4)
    await user.click(within(issues).getByRole('button', { name: 'Show all 9 issues' }))
    expect(within(issues).getAllByRole('link')).toHaveLength(9)
    await user.click(within(issues).getByRole('link', { name: /SSH: failed/ }))
    expect(screen.getByRole('heading', { name: 'Services', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })
  it('shows CPU capacity against the observed peak and explains its reference', async () => {
    const user = userEvent.setup()
    updateSnapshot = (s) => {
      s.cpu_capacity = { peak_cores: 0.8, observed_since: s.history[0].at }
      s.history = [
        {
          at: new Date().toISOString(),
          cpu_percent: 20,
          cpu_usage_cores: 0.4,
          cpu_capacity_cores: 2,
          memory_percent: 20,
          disk_percent: 30,
        },
      ]
    }
    signedIn()
    render(<App />)
    await screen.findByRole('region', { name: 'Monitoring issues' })
    const card = within(screen.getByRole('group', { name: 'CPU capacity' }))
    expect(card.getByText('50.0%')).toBeInTheDocument()
    expect(card.getByText('Relative to peak')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'About CPU capacity' })).not.toBeInTheDocument()
    await user.hover(card.getByRole('button', { name: 'About CPU capacity' }))
    expect(await screen.findByRole('dialog', { name: 'About CPU capacity' })).toHaveTextContent(
      /100% = highest observed use.*since/,
    )
    expect(card.getByText('50.0%')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'About CPU capacity' })).not.toBeInTheDocument(),
    )
  })
  it('does not label legacy raw CPU readings as relative capacity', async () => {
    updateSnapshot = (s) => {
      delete s.cpu_capacity
    }
    signedIn()
    render(<App />)
    await screen.findByRole('region', { name: 'Monitoring issues' })
    const card = within(screen.getByRole('group', { name: 'CPU capacity' }))
    expect(card.getByText('Unavailable')).toBeInTheDocument()
    expect(card.getByText(/Historical CPU reference unavailable/)).toBeInTheDocument()
  })
  it('uses live basic readings when resource history is stale', async () => {
    updateSnapshot = (snapshot) => {
      snapshot.history = demoTelemetry(Date.now() - 600000).history
    }
    signedIn()
    render(<App />)
    await screen.findByRole('region', { name: 'Monitoring issues' })
    expect(
      within(screen.getByRole('group', { name: 'CPU capacity' })).getByText('Unavailable'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Memory usage' })).getByText('37.5%'),
    ).toBeInTheDocument()
  })
  it('filters tasks by search and health, including stopped schedulers', async () => {
    updateSnapshot = (snapshot) => {
      snapshot.jobs[0].timer_state = 'inactive'
    }
    const user = userEvent.setup()
    signedIn()
    window.history.replaceState(null, '', '#tasks')
    render(<App />)
    const search = await screen.findByRole('textbox', { name: 'Search tasks' })
    await user.click(screen.getByRole('button', { name: 'Needs attention (1)' }))
    expect(screen.getByText('Scheduled maintenance')).toBeInTheDocument()
    expect(screen.queryByText('Application backup')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Needs attention (1)' }))
    await user.type(search, 'backup')
    expect(screen.getByText('Application backup')).toBeInTheDocument()
    expect(screen.queryByText('Scheduled maintenance')).not.toBeInTheDocument()
  })
  it('does not describe a failed collector request as disabled', async () => {
    signedIn()
    failures.add('telemetry')
    window.history.replaceState(null, '', '#processes')
    render(<App />)
    await screen.findByRole('button', { name: 'Retry Processes' }, { timeout: 4000 })
    expect(screen.queryByText('Process monitoring is not enabled')).not.toBeInTheDocument()
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => alert.textContent?.includes('Source unavailable')),
    ).toBe(true)
  })
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
    await waitFor(
      () =>
        expect(
          screen
            .getAllByRole('alert')
            .some((alert) => alert.textContent?.includes('Source unavailable')),
        ).toBe(true),
      {
        timeout: 4000,
      },
    )
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
