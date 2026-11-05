import { expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { demoTelemetry } from '@/lib/demo'
import { StoragePage } from './storage'

vi.mock('@/hooks/use-api', () => ({ useApi: () => ({ data: [], isPending: false }) }))

it('keeps null database measurements unavailable while preserving measured zero', () => {
  const now = Date.now()
  const snapshot = demoTelemetry(now)
  const database = {
    status: 'healthy' as const,
    checked_at: snapshot.collected_at,
    limit_bytes: 100_000_000,
  }
  snapshot.databases = [
    {
      ...database,
      name: 'Unavailable database',
      bytes: null,
      available_bytes: null,
      connections: null,
      used_percent: null,
      tls: null,
      latency_ms: null,
    },
    {
      ...database,
      name: 'Empty database',
      bytes: 0,
      available_bytes: 0,
      connections: 0,
      tls: false,
      latency_ms: 0,
    },
  ]
  render(<StoragePage snapshot={snapshot} now={now} />)
  const missing = within(screen.getByText('Unavailable database').closest('tr')!)
  expect(missing.getByText(/^Unavailable \/ .* MB$/)).toBeInTheDocument()
  expect(missing.queryByText(/^0 MB/)).not.toBeInTheDocument()
  expect(missing.queryByText(/null|Unencrypted| ms/)).not.toBeInTheDocument()
  const measured = within(screen.getByText('Empty database').closest('tr')!)
  expect(measured.getByText(/^0 MB \/ .* MB$/)).toBeInTheDocument()
  expect(measured.getByText('Unencrypted / 0 ms')).toBeInTheDocument()
})
