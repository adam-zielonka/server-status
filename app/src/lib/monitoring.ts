import type { HistoryMetric, HistoryPoint, Job, JobHealth, Page, TelemetrySnapshot } from '@/types'
import { formatPercent, isNumber } from './format'

export function ageSeconds(value?: string | null, now = Date.now()): number | null {
  const at = value ? Date.parse(value) : NaN
  return Number.isFinite(at) ? Math.max(0, (now - at) / 1000) : null
}

export function snapshotIsStale(snapshot?: Partial<TelemetrySnapshot>, now = Date.now()): boolean {
  const age = ageSeconds(snapshot?.collected_at, now)
  const at = Date.parse(snapshot?.collected_at || '')
  return (
    age === null ||
    at > now + 60000 ||
    age > Math.max(180, (snapshot?.sample_interval_seconds || 60) * 3)
  )
}

export function jobHealth(job: Job, now = Date.now()): JobHealth {
  if (job.error || job.status === 'unknown') return 'unknown'
  if (job.status === 'failure') return 'failure'
  if (Date.parse(job.last_success_at || '') > now + 60000) return 'unknown'
  const age = ageSeconds(job.last_success_at, now)
  if (age === null || age > (job.max_age_seconds || 86400)) return 'overdue'
  return job.status === 'running' ? 'running' : 'success'
}

export function directoryGrowth(history: HistoryPoint[], name: string): number | null {
  const points = [...history]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((p) => p.directory_bytes?.[name])
    .filter(isNumber)
  return points.length < 2 ? null : points[points.length - 1] - points[0]
}

export function hasFullHistoryWindow(recordedSeconds: number, sampleInterval = 60): boolean {
  return recordedSeconds >= 86400 - Math.max(120, sampleInterval * 2)
}

// Null points make Recharts leave real gaps instead of inventing continuity.
export function chartHistory(
  history: HistoryPoint[],
  start: number,
  end: number,
  maxGapSeconds: number,
): HistoryPoint[] {
  const rows: HistoryPoint[] = []
  let last = 0
  for (const point of [...history].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const at = Date.parse(point.at)
    if (!Number.isFinite(at) || at < start || at > end) continue
    if (last && at - last > maxGapSeconds * 1000)
      rows.push({
        at: new Date(last + 1).toISOString(),
        cpu_percent: null,
        memory_percent: null,
        disk_percent: null,
      })
    rows.push(point)
    last = at
  }
  return rows
}

export interface MonitoringIssue {
  id: string
  message: string
  page: Page
  severity: 'critical' | 'warning'
}

export function latestHistoryPoint(
  history: HistoryPoint[],
  now = Date.now(),
): HistoryPoint | undefined {
  let latest: HistoryPoint | undefined
  let last = -Infinity
  for (const point of history) {
    const at = Date.parse(point.at)
    if (Number.isFinite(at) && at <= now + 60000 && at >= last) {
      latest = point
      last = at
    }
  }
  return latest
}

export function resourceSampleIsStale(snapshot: TelemetrySnapshot, now = Date.now()): boolean {
  return snapshotIsStale(
    {
      collected_at: latestHistoryPoint(snapshot.history, now)?.at,
      sample_interval_seconds: snapshot.sample_interval_seconds,
    },
    now,
  )
}

export function monitoringIssues(snapshot: TelemetrySnapshot, now = Date.now()): MonitoringIssue[] {
  const issues: MonitoringIssue[] = []
  const add = (
    id: string,
    message: string,
    page: Page,
    severity: MonitoringIssue['severity'] = 'warning',
  ) => issues.push({ id, message, page, severity })
  if (snapshotIsStale(snapshot, now))
    add('snapshot', 'Monitoring data is stale. Current health cannot be confirmed.', 'system')
  else if (resourceSampleIsStale(snapshot, now))
    add(
      'samples',
      'Resource samples are stale or unavailable. Current CPU usage cannot be confirmed.',
      'overview',
    )
  for (const service of snapshot.services)
    if (service.error || service.state !== 'active')
      add(
        `service:${service.id}`,
        `${service.name}: ${service.error ? 'state unavailable' : service.state}`,
        'services',
        service.state === 'failed' ? 'critical' : 'warning',
      )
  const point = latestHistoryPoint(snapshot.history, now)
  const thresholds: [HistoryMetric, number, string, Page][] = [
    ['cpu_percent', 85, 'CPU usage', 'processes'],
    ['memory_percent', 90, 'Memory working set', 'processes'],
    ['disk_percent', 85, 'Disk usage', 'storage'],
  ]
  for (const [field, threshold, label, page] of thresholds) {
    const value = point?.[field]
    if (isNumber(value) && value >= threshold)
      add(
        field,
        resourceSampleIsStale(snapshot, now)
          ? `${label} was high (${formatPercent(value)}) in the last recorded sample.`
          : `${label} is high (${formatPercent(value)}).`,
        page,
        value >= 95 ? 'critical' : 'warning',
      )
  }
  const ts = snapshot.tailscale
  if (ts && (ts.error || ts.state !== 'Running' || !ts.online))
    add('tailscale', 'Tailscale connectivity needs attention.', 'network')
  if (ts?.services?.some((s) => s.funnel))
    add('funnel', 'A Tailscale route is publicly exposed through Funnel.', 'network')
  if (isNumber(ts?.key_days_remaining) && ts.key_days_remaining <= 14)
    add('node-key', 'The Tailscale node key expires within 14 days or has expired.', 'network')
  for (const job of snapshot.jobs) {
    const health = jobHealth(job, now)
    if (['failure', 'overdue', 'unknown'].includes(health))
      add(
        `job:${job.name}`,
        `${job.name}: ${health}`,
        'tasks',
        health === 'failure' ? 'critical' : 'warning',
      )
    if (job.timer_state && job.timer_state !== 'active')
      add(`timer:${job.name}`, `${job.name}: scheduler is ${job.timer_state}`, 'tasks')
  }
  for (const directory of snapshot.directories)
    if (directory.error)
      add(
        `directory:${directory.name}`,
        `${directory.name}: directory size could not be refreshed.`,
        'storage',
      )
  for (const database of snapshot.databases || []) {
    if (database.error || database.status !== 'healthy')
      add(
        `database:${database.name}`,
        `${database.name}: database ${database.error ? 'unknown' : database.status}`,
        'storage',
        database.status === 'failure' ? 'critical' : 'warning',
      )
    if (database.tls === false)
      add(
        `tls:${database.name}`,
        `${database.name}: database connection is not encrypted`,
        'storage',
      )
  }
  for (const tunnel of snapshot.tunnels || [])
    if (tunnel.error || tunnel.status !== 'healthy')
      add(
        `tunnel:${tunnel.name}`,
        `${tunnel.name}: tunnel ${tunnel.error ? 'unknown' : tunnel.status}`,
        'network',
        tunnel.status === 'failure' ? 'critical' : 'warning',
      )
  const software = snapshot.software
  if (software) {
    if (softwareIsStale(software, now))
      add('software-stale', 'Software update checks are stale.', 'software')
    const count =
      software.tools.filter((t) => t.status === 'update_available').length +
      (software.apt?.updates.length || 0)
    if (count) add('software-updates', `${count} software updates available.`, 'software')
    if (software.apt?.error || software.tools.some((t) => t.error || t.status === 'unknown'))
      add('software-unknown', 'Some software versions could not be checked.', 'software')
  }
  return issues.sort(
    (a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical'),
  )
}

export function monitoringAlerts(snapshot: TelemetrySnapshot, now = Date.now()): string[] {
  return monitoringIssues(snapshot, now).map((issue) => issue.message)
}

export function softwareIsStale(software: import('@/types').SoftwareInfo, now: number): boolean {
  const age = ageSeconds(software.checked_at, now)
  return (
    age === null ||
    Date.parse(software.checked_at) > now + 60000 ||
    age > software.interval_seconds * 1.25 + 60
  )
}
