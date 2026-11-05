import { Suspense } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { TelemetrySourceProvider } from '@/components/telemetry-card'
import { demoTelemetry } from '@/lib/demo'
import { Overview } from './overview'
import { ServicesPage } from './services'
import type { TelemetrySnapshot } from '@/types'

vi.mock('@/hooks/use-api', () => ({ useApi: () => ({ data: [], isPending: false }) }))
vi.mock('./resource-history', () => ({ default: () => null }))

const now = Date.now()
const retry = vi.fn()
function views(
  snapshot: TelemetrySnapshot | undefined,
  pending = false,
  error: Error | null = null,
) {
  return (
    <TelemetrySourceProvider value={{ available: !!snapshot, pending, error, retry }}>
      <Suspense>
        <Overview snapshot={snapshot} now={now} loading={false} onPageChange={() => {}} />
        <ServicesPage snapshot={snapshot} now={now} />
      </Suspense>
    </TelemetrySourceProvider>
  )
}
const metric = () => within(screen.getByRole('group', { name: 'Services running' }))
const serviceCard = () =>
  within(
    screen
      .getByRole('heading', { name: 'System services' })
      .closest('[data-slot="card"]') as HTMLElement,
  )

describe('shared services source state', () => {
  it('keeps first-load errors distinct from disabled monitoring', () => {
    const view = render(views(undefined, false, new Error('Synthetic telemetry failure')))
    expect(metric().getByText('Unavailable')).toBeInTheDocument()
    expect(serviceCard().getByText('Unavailable')).toBeInTheDocument()
    expect(serviceCard().getByRole('alert')).toHaveTextContent('Synthetic telemetry failure')
    expect(screen.queryByText('0 active')).not.toBeInTheDocument()
    expect(screen.queryByText('Not enabled')).not.toBeInTheDocument()
    expect(screen.queryByText('Service health is not enabled')).not.toBeInTheDocument()
    view.rerender(views(undefined))
    expect(metric().getByText('Not enabled')).toBeInTheDocument()
    expect(serviceCard().getByText('Not enabled')).toBeInTheDocument()
    expect(serviceCard().getByText('Service health is not enabled')).toBeInTheDocument()
    expect(serviceCard().queryByRole('alert')).not.toBeInTheDocument()
  })
  it('labels initial loading without reporting healthy or disabled services', () => {
    render(views(undefined, true))
    expect(serviceCard().getByText('Loading')).toBeInTheDocument()
    expect(metric().getByText('Waiting for telemetry')).toBeInTheDocument()
    expect(screen.getByLabelText('Loading System services')).toBeInTheDocument()
    expect(screen.queryByText('0 active')).not.toBeInTheDocument()
    expect(screen.queryByText('Not enabled')).not.toBeInTheDocument()
  })
  it('distinguishes unconfigured monitoring from a healthy service count', () => {
    const snapshot = demoTelemetry(now)
    snapshot.services = []
    render(views(snapshot))
    expect(metric().getByText('Not configured')).toBeInTheDocument()
    expect(serviceCard().getByText('Not configured')).toBeInTheDocument()
    expect(screen.queryByText('0 active')).not.toBeInTheDocument()
  })
  it('retains cached readings while reporting a refresh failure in both summaries', () => {
    const snapshot = demoTelemetry(now)
    render(views(snapshot, false, new Error('Refresh unavailable')))
    expect(metric().getByText('Last observed state · telemetry refresh failed')).toBeInTheDocument()
    expect(serviceCard().getByText('Refresh failed')).toBeInTheDocument()
    expect(serviceCard().getByRole('alert')).toHaveTextContent('Refresh unavailable')
    expect(serviceCard().getByText('SSH')).toBeInTheDocument()
    expect(screen.queryByText(/^\d+ active$/)).not.toBeInTheDocument()
  })
  it('labels stale summaries consistently and counts service read errors as attention', () => {
    const snapshot = demoTelemetry(now - 600_000)
    const view = render(views(snapshot))
    expect(metric().getByText('Last observed state · monitoring data is stale')).toBeInTheDocument()
    expect(serviceCard().getByTitle(`Last reported status: Stale`)).toHaveTextContent('Stale')
    snapshot.collected_at = new Date(now).toISOString()
    snapshot.services = [{ ...snapshot.services[0], state: 'active', error: 'Read failed' }]
    view.rerender(views(snapshot))
    expect(metric().getByText('0 / 1')).toBeInTheDocument()
    expect(serviceCard().getByText('0 active')).toHaveClass('text-amber-800')
    expect(metric().getByText('Some services need attention')).toBeInTheDocument()
  })
  it('shows healthy fresh readings even during a background refresh', () => {
    const snapshot = demoTelemetry(now)
    snapshot.services = [{ ...snapshot.services[0], state: 'active' }]
    render(views(snapshot, true))
    expect(metric().getByText('1 / 1')).toBeInTheDocument()
    expect(serviceCard().getByText('1 active')).toHaveClass('text-emerald-700')
    expect(metric().getByText('All monitored services are active')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading System services')).not.toBeInTheDocument()
  })
})
