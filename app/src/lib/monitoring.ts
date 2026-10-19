import type { HistoryMetric, HistoryPoint, Job, JobHealth, TelemetrySnapshot } from '@/types'
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
  const age = ageSeconds(job.last_success_at, now)
  if (age === null || age > (job.max_age_seconds || 86400)) return 'overdue'
  return job.status === 'running' ? 'running' : 'success'
}

export function directoryGrowth(history: HistoryPoint[], name: string): number | null {
  const points = history.map((p) => p.directory_bytes?.[name]).filter(isNumber)
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
  for (const point of history) {
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

export function monitoringAlerts(snapshot: TelemetrySnapshot, now = Date.now()): string[] {
  const alerts: string[] = []
  if (snapshotIsStale(snapshot, now))
    alerts.push('Monitoring data is stale. Current health cannot be confirmed.')
  for (const service of snapshot.services)
    if (service.state !== 'active') alerts.push(`${service.name}: ${service.state}`)
  const point = snapshot.history.at(-1)
  const thresholds: [HistoryMetric, number, string][] = [
    ['cpu_percent', 85, 'CPU usage'],
    ['memory_percent', 90, 'Memory working set'],
    ['disk_percent', 85, 'Disk usage'],
  ]
  for (const [field, threshold, label] of thresholds) {
    const value = point?.[field]
    if (isNumber(value) && value >= threshold)
      alerts.push(`${label} is high (${formatPercent(value)}).`)
  }
  const ts = snapshot.tailscale
  if (ts && (ts.state !== 'Running' || !ts.online))
    alerts.push('Tailscale connectivity needs attention.')
  if (ts?.services?.some((s) => s.funnel))
    alerts.push('A Tailscale route is publicly exposed through Funnel.')
  if (isNumber(ts?.key_days_remaining) && ts.key_days_remaining <= 14)
    alerts.push('The Tailscale node key expires within 14 days or has expired.')
  for (const job of snapshot.jobs) {
    const health = jobHealth(job, now)
    if (['failure', 'overdue', 'unknown'].includes(health)) alerts.push(`${job.name}: ${health}`)
    if (job.timer_state && job.timer_state !== 'active')
      alerts.push(`${job.name}: scheduler is ${job.timer_state}`)
  }
  for (const directory of snapshot.directories)
    if (directory.error) alerts.push(`${directory.name}: directory size could not be refreshed.`)
  return alerts
}
