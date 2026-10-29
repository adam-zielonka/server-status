import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ResourceHistory from './resource-history'
import { demoTelemetry } from '@/lib/demo'

const now = Date.parse('2026-10-29T12:00:00Z')
function snapshot() {
  const value = demoTelemetry(now)
  value.cpu_capacity = { peak_cores: 2, observed_since: new Date(now - 86400000).toISOString() }
  value.history = Array.from({ length: 101 }, (_, i) => ({
    at: new Date(now - i * 60000).toISOString(),
    cpu_percent: i === 0 ? null : 50,
    cpu_usage_cores: i === 0 ? null : 1,
    memory_percent: 60,
    disk_percent: 70,
  }))
  return value
}

describe('recorded resource data', () => {
  it('keeps unavailable values, CPU reference, real sample times and pagination in the alternative table', async () => {
    const user = userEvent.setup()
    render(<ResourceHistory snapshot={snapshot()} now={now} />)
    await user.click(screen.getByText('View recorded samples (101)'))
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(51)
    const first = within(table).getAllByRole('row')[1]
    expect(
      within(first)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Unavailable', '60.0%', '70.0%'])
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('50.0%')
    expect(table.querySelector('time')).toHaveAttribute('dateTime', new Date(now).toISOString())
    await user.click(screen.getByRole('button', { name: 'Older samples' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '1h' }))
    expect(screen.getByText('View recorded samples (61)')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('exposes explicit keyboard-operable selection and preserves collecting/disabled states', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ResourceHistory snapshot={snapshot()} now={now} />)
    const controls = within(screen.getByRole('group', { name: 'Visible resource series' }))
    await user.click(controls.getByRole('button', { name: 'Disk' }))
    expect(controls.getByRole('button', { name: 'Disk' })).toHaveAttribute('aria-pressed', 'true')
    expect(controls.getByRole('button', { name: 'All series' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    rerender(<ResourceHistory snapshot={{ ...snapshot(), history: [] }} now={now} />)
    expect(screen.getByText('History is collecting')).toBeInTheDocument()
    rerender(<ResourceHistory now={now} />)
    expect(screen.getByText('Resource history is not enabled')).toBeInTheDocument()
  })
})
