import { describe, expect, it } from 'vitest'
import { demoTelemetry } from './demo'
import {
  ageSeconds,
  chartHistory,
  directoryGrowth,
  jobHealth,
  monitoringAlerts,
  monitoringIssues,
  resourceSampleIsStale,
  latestHistoryPoint,
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
  it('flags database capacity, unavailable metrics and unencrypted connections', () => {
    const snapshot = demoTelemetry(now)
    snapshot.databases = [
      {
        name: 'Shared database',
        status: 'warning',
        checked_at: new Date(now).toISOString(),
        limit_bytes: 200_000_000,
        tls: false,
      },
    ]
    expect(monitoringAlerts(snapshot, now)).toContain('Shared database: database warning')
    expect(monitoringAlerts(snapshot, now)).toContain(
      'Shared database: database connection is not encrypted',
    )
    snapshot.databases[0].status = 'unknown'
    expect(monitoringAlerts(snapshot, now)).toContain('Shared database: database unknown')
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
  it('does not invent alerts for a healthy snapshot', () => {
    const snapshot = demoTelemetry(now)
    snapshot.software!.tools.forEach((t) => {
      t.status = 'current'
      delete t.error
    })
    snapshot.software!.apt!.updates = []
    snapshot.software!.apt!.status = 'current'
    expect(monitoringAlerts(snapshot, now)).toEqual([])
  })
  it('does not mistake a newly published snapshot for fresh resource samples', () => {
    const snapshot = demoTelemetry(now - 600000)
    snapshot.collected_at = new Date(now).toISOString()
    expect(snapshotIsStale(snapshot, now)).toBe(false)
    expect(resourceSampleIsStale(snapshot, now)).toBe(true)
    expect(monitoringIssues(snapshot, now)).toContainEqual(
      expect.objectContaining({ id: 'samples', page: 'overview' }),
    )
  })
  it('prioritizes critical issues and links each issue to its diagnostic view', () => {
    const snapshot = demoTelemetry(now)
    snapshot.tailscale!.key_days_remaining = 3
    snapshot.services[0].state = 'failed'
    const issues = monitoringIssues(snapshot, now)
    expect(issues[0]).toMatchObject({ severity: 'critical', page: 'services' })
    expect(issues.find((issue) => issue.id === 'node-key')).toMatchObject({ page: 'network' })
  })
  it('does not trust success timestamps far in the future', () => {
    expect(jobHealth({ ...goodJob, last_success_at: '2027-01-01T00:00:00Z' }, now)).toBe('unknown')
  })
  it('alerts on degraded, disconnected and unavailable tunnel monitoring', () => {
    const snapshot = demoTelemetry(now)
    for (const status of ['degraded', 'failure', 'unknown'] as const) {
      snapshot.tunnels![0].status = status
      expect(monitoringAlerts(snapshot, now)).toContain(
        `Example application tunnel: tunnel ${status}`,
      )
    }
    delete snapshot.tunnels
    delete snapshot.software
    expect(monitoringAlerts(snapshot, now)).toEqual([])
  })
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
  it('orders observations chronologically without allowing future samples to become current', () => {
    const early = point('2026-01-05T11:00:00Z', 10)
    const late = point('2026-01-05T11:01:00Z', 20)
    const future = point('2026-01-06T12:00:00Z', 99)
    expect(
      chartHistory([late, early, future], now - 3600000, now, 180).map((row) => row.cpu_percent),
    ).toEqual([10, 20])
    expect(latestHistoryPoint([late, future, early], now)).toEqual(late)
  })
})
