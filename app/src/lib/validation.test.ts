import { describe, expect, it } from 'vitest'
import { demoTelemetry } from './demo'
import { monitoringIssues } from './monitoring'
import { validEndpoint } from './validation'

// Traverse synthetic snapshots as unknown so invalid wire types are tested without casts.
function changed(path: string, value: unknown) {
  const snapshot = structuredClone(demoTelemetry())
  snapshot.databases = [
    {
      name: 'Example database',
      status: 'healthy',
      checked_at: snapshot.collected_at,
      limit_bytes: 100_000_000,
    },
  ]
  const parts = path.split('.')
  let row: unknown = snapshot
  for (const part of parts.slice(0, -1)) row = (row as Record<string, unknown>)[part]
  const target = row as Record<string, unknown>
  if (value === undefined) delete target[parts.at(-1)!]
  else target[parts.at(-1)!] = value
  return snapshot
}

const optionalDates = [
  'sample_at',
  'cpu_capacity.observed_since',
  'services.0.last_error_at',
  'directories.0.collected_at',
  'jobs.0.last_run_at',
  'jobs.0.completed_at',
  'jobs.0.last_success_at',
  'jobs.0.next_run_at',
  'jobs.0.checked_at',
  'tailscale.expires_at',
  'software.checked_at',
  'software.tools.0.checked_at',
  'software.apt.checked_at',
  'software.apt.security_index_at',
  'backup_stores.0.checked_at',
  'backup_stores.0.last_success_at',
  'databases.0.checked_at',
  'tunnels.0.checked_at',
]

describe('telemetry date contract', () => {
  it.each(['collected_at', 'history.0.at', ...optionalDates])(
    'validates %s before consumption',
    (path) => {
      for (const invalid of [
        { toString: 0 },
        [],
        0,
        true,
        '',
        'not a date',
        '2026-02-30T12:00:00Z',
        '2026-13-99T99:99:99Z',
      ]) {
        expect(
          validEndpoint('telemetry', changed(path, invalid)),
          `${path}: ${JSON.stringify(invalid)}`,
        ).toBe(false)
      }
    },
  )
  it.each(optionalDates)('accepts sensible missing/null dates in schema 1: %s', (path) => {
    for (const value of [null, undefined]) {
      const snapshot = changed(path, value)
      expect(validEndpoint('telemetry', snapshot)).toBe(true)
      expect(() => monitoringIssues(snapshot)).not.toThrow()
    }
  })
  it('requires dates that identify the snapshot and history observations', () => {
    for (const path of ['collected_at', 'history.0.at'])
      for (const value of [null, undefined])
        expect(validEndpoint('telemetry', changed(path, value))).toBe(false)
  })
  it('accepts systemd service error dates and displays them without a crash', () => {
    const snapshot = changed('services.0.last_error_at', 'Thu 2026-11-05 11:01:00 UTC')
    expect(validEndpoint('telemetry', snapshot)).toBe(true)
    expect(() => monitoringIssues(snapshot)).not.toThrow()
  })
})

const optionalFields = [
  'cpu_capacity',
  'tailscale',
  'software',
  'databases',
  'backup_stores',
  'tunnels',
  'container.effective_cpu_cores',
  'container.cpu_quota_cores',
  'container.cpu_capacity_cores',
  'container.memory_limit_bytes',
  'container.memory_current_bytes',
  'container.memory_working_set_bytes',
  'processes.top_cpu.0.cpu_percent',
  'processes.groups_cpu.0.instance_pid',
  'processes.groups_cpu.0.member_pids',
  'processes.groups_cpu.0.group_kind',
  'services.0.restarts',
  'services.0.error',
  'services.0.substate',
  'services.0.result',
  'directories.0.bytes',
  'jobs.0.max_age_seconds',
  'jobs.0.source_url',
  'history.0.cpu_capacity_cores',
  'history.0.cpu_usage_cores',
  'history.0.memory_bytes',
  'history.0.disk_used_bytes',
  'history.0.directory_bytes',
  'databases.0.bytes',
  'databases.0.available_bytes',
  'databases.0.used_percent',
  'databases.0.connections',
  'databases.0.tls',
  'databases.0.latency_ms',
  'backup_stores.0.latest_backup_bytes',
  'backup_stores.0.backup_count',
  'tailscale.services',
  'tailscale.addresses',
  'tailscale.key_days_remaining',
  'software.apt',
  'software.tools.0.channel',
  'software.tools.0.source_url',
  'software.apt.updates.0.source_url',
  'tunnels.0.locations',
  'tunnels.0.connections',
]

describe('nullable schema 1 fields', () => {
  it.each(optionalFields)('accepts unavailable %s but rejects wrong wire types', (path) => {
    for (const value of [null, undefined])
      expect(validEndpoint('telemetry', changed(path, value))).toBe(true)
    expect(validEndpoint('telemetry', changed(path, { unexpected: true }))).toBe(false)
  })
})
