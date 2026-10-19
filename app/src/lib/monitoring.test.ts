import { describe, expect, it } from 'vitest'
import { demoTelemetry } from './demo'
import {
  ageSeconds,
  chartHistory,
  directoryGrowth,
  jobHealth,
  monitoringAlerts,
  hasFullHistoryWindow,
  snapshotIsStale,
} from './monitoring'
import type { HistoryPoint, Job } from '@/types'

const now = Date.parse('2026-01-05T12:00:00Z')
const goodJob: Job = {
  name: 'Example task',
  kind: 'systemd',
  status: 'success',
  last_success_at: '2026-01-05T11:00:00Z',
  max_age_seconds: 7200,
}

describe('freshness and health', () => {
  it('does not treat missing, old or future-dated snapshots as healthy', () => {
    expect(snapshotIsStale({}, now)).toBe(true)
    expect(snapshotIsStale({ collected_at: '2026-01-05T11:50:00Z' }, now)).toBe(true)
    expect(snapshotIsStale({ collected_at: '2026-01-06T11:59:00Z' }, now)).toBe(true)
    expect(snapshotIsStale({ collected_at: '2026-01-05T11:59:00Z' }, now)).toBe(false)
    expect(ageSeconds('invalid', now)).toBeNull()
  })
  it('separates failed, running, unknown and overdue tasks', () => {
    expect(jobHealth(goodJob, now)).toBe('success')
    expect(jobHealth({ ...goodJob, status: 'failure' }, now)).toBe('failure')
    expect(jobHealth({ ...goodJob, status: 'running' }, now)).toBe('running')
    expect(jobHealth({ ...goodJob, error: 'Unavailable' }, now)).toBe('unknown')
    expect(jobHealth({ ...goodJob, max_age_seconds: 60 }, now)).toBe('overdue')
    expect(jobHealth({ ...goodJob, last_success_at: null }, now)).toBe('overdue')
  })
  it('reports stale data, stopped schedulers, public exposure and resource pressure', () => {
    const snapshot = demoTelemetry(now)
    snapshot.collected_at = '2026-01-04T00:00:00Z'
    snapshot.jobs = [{ ...goodJob, timer_state: 'inactive' }]
    snapshot.services[0].state = 'failed'
    snapshot.history.at(-1)!.memory_percent = 95
    snapshot.tailscale!.services![0].funnel = true
    snapshot.tailscale!.key_days_remaining = 2
    const alerts = monitoringAlerts(snapshot, now)
    expect(alerts).toContain('A Tailscale route is publicly exposed through Funnel.')
    expect(alerts).toContain('Example task: scheduler is inactive')
    expect(alerts.some((row) => row.includes('stale'))).toBe(true)
    expect(alerts.some((row) => row.includes('Memory working set'))).toBe(true)
    expect(alerts.some((row) => row.includes('expires'))).toBe(true)
    expect(alerts.some((row) => row.includes('SSH: failed'))).toBe(true)
  })
  it('does not invent alerts for a healthy snapshot', () =>
    expect(monitoringAlerts(demoTelemetry(now), now)).toEqual([]))
})

describe('history integrity', () => {
  it('recognizes a full sampled window without requiring an exact 24-hour endpoint', () => {
    expect(hasFullHistoryWindow(1439 * 60)).toBe(true)
    expect(hasFullHistoryWindow(3600)).toBe(false)
  })
  const point = (at: string, value: number | null): HistoryPoint => ({
    at,
    cpu_percent: value,
    memory_percent: value,
    disk_percent: value,
  })
  it('inserts a null sample across recording gaps and clips the requested window', () => {
    const rows = chartHistory(
      [
        point('2026-01-05T10:00:00Z', 1),
        point('2026-01-05T11:00:00Z', 10),
        point('2026-01-05T11:10:00Z', 20),
        point('2026-01-05T12:01:00Z', 30),
      ],
      now - 3600000,
      now,
      180,
    )
    expect(rows.map((row) => row.cpu_percent)).toEqual([10, null, 20])
  })
  it('requires a real growth baseline and preserves decreases', () => {
    const first = { ...point('2026-01-05T11:00:00Z', 0), directory_bytes: { Data: 100 } }
    const second = { ...first, directory_bytes: { Data: 80 } }
    expect(directoryGrowth([first], 'Data')).toBeNull()
    expect(directoryGrowth([first, second], 'Data')).toBe(-20)
    expect(directoryGrowth([], 'Missing')).toBeNull()
  })
})
