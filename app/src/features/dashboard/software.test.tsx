import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SoftwarePage } from './software'
import { demoTelemetry } from '@/lib/demo'
import { monitoringIssues } from '@/lib/monitoring'

it('shows versions, filters updates, and keeps failed sources unknown', async () => {
  const user = userEvent.setup()
  const snapshot = demoTelemetry()
  render(<SoftwarePage snapshot={snapshot} now={Date.now()} />)
  expect(screen.getByText('24.4.0')).toBeInTheDocument()
  expect(screen.getByText('Unknown')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Updates available (2)' }))
  expect(screen.queryByText('Example CLI')).not.toBeInTheDocument()
  expect(screen.getByText('example-utils')).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'Search software' }), 'node')
  expect(screen.queryByText('example-utils')).not.toBeInTheDocument()
  expect(screen.getByText('Node.js')).toBeInTheDocument()
})
it('marks software stale independently of fresh telemetry and links the warning', () => {
  const now = Date.now()
  const snapshot = demoTelemetry(now)
  snapshot.software!.checked_at = new Date(now - 86400000).toISOString()
  render(<SoftwarePage snapshot={snapshot} now={now} />)
  expect(screen.getAllByText('Stale')).toHaveLength(5)
  expect(screen.queryByText('Up to date')).not.toBeInTheDocument()
  expect(monitoringIssues(snapshot, now)).toContainEqual(
    expect.objectContaining({ id: 'software-stale', page: 'software' }),
  )
})
it('accepts older snapshots and never marks wholly unknown checks healthy', () => {
  const snapshot = demoTelemetry()
  snapshot.software!.apt = null
  snapshot.software!.tools = snapshot.software!.tools.filter((t) => t.status === 'unknown')
  const view = render(<SoftwarePage snapshot={snapshot} now={Date.now()} />)
  expect(screen.getByText('Version checks incomplete')).toBeInTheDocument()
  delete snapshot.software
  view.rerender(<SoftwarePage snapshot={snapshot} now={Date.now()} />)
  expect(screen.getByText('Software monitoring is not configured')).toBeInTheDocument()
})
