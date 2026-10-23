import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NetworkPage } from './network'
import { demoTelemetry } from '@/lib/demo'

vi.mock('@/hooks/use-api', () => ({ useApi: () => ({ data: [], isPending: false }) }))

describe('Cloudflare tunnel monitoring', () => {
  it('shows configured routes, active connections and connector counters', () => {
    render(<NetworkPage now={Date.now()} snapshot={demoTelemetry()} />)
    expect(screen.getByText('Cloudflare Tunnels')).toBeInTheDocument()
    expect(screen.getByText('app.example.com')).toBeInTheDocument()
    expect(screen.getByText('4 / 4')).toBeInTheDocument()
    expect(screen.getByText('ams01, fra01')).toBeInTheDocument()
    expect(screen.getByText('healthy')).toBeInTheDocument()
    expect(screen.getByText(/This does not verify application availability/)).toBeInTheDocument()
  })
  it('labels stale readings and keeps missing connection counts unavailable', () => {
    const snapshot = demoTelemetry(Date.now() - 600_000)
    delete snapshot.tunnels![0].connections
    snapshot.tunnels![0].status = 'unknown'
    snapshot.tunnels![0].error = 'Local connector metrics are unavailable'
    render(<NetworkPage now={Date.now()} snapshot={snapshot} />)
    expect(screen.getAllByText('Stale')).toHaveLength(2)
    expect(screen.queryByText('connected')).not.toBeInTheDocument()
    expect(screen.queryByText('healthy')).not.toBeInTheDocument()
    expect(screen.queryByText('0 / 4')).not.toBeInTheDocument()
    expect(screen.getByText('Local connector metrics are unavailable')).toBeInTheDocument()
  })
  it('handles snapshots from before tunnel monitoring was configured', () => {
    const snapshot = demoTelemetry()
    delete snapshot.tunnels
    render(<NetworkPage now={Date.now()} snapshot={snapshot} />)
    expect(screen.getByText('No Cloudflare Tunnels configured')).toBeInTheDocument()
  })
})
