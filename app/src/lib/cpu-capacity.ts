import type { HistoryPoint, TelemetrySnapshot } from '@/types'

const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export function cpuRelativePercent(
  point: HistoryPoint | undefined,
  snapshot: TelemetrySnapshot | undefined,
): number | null {
  const peak = snapshot?.cpu_capacity
  if (
    !point ||
    !peak ||
    !nonnegative(peak.peak_cores) ||
    peak.peak_cores === 0 ||
    !peak.observed_since ||
    !Number.isFinite(Date.parse(peak.observed_since))
  )
    return null
  // A missing CPU sample remains a gap, even if another field is present.
  if (!nonnegative(point.cpu_percent)) return null
  const capacity = point.cpu_capacity_cores ?? snapshot?.container.effective_cpu_cores
  const usage = nonnegative(point.cpu_usage_cores)
    ? point.cpu_usage_cores
    : nonnegative(capacity) && capacity > 0
      ? (point.cpu_percent / 100) * capacity
      : null
  if (usage === null) return null
  const percent = (usage / peak.peak_cores) * 100
  // A mismatched snapshot must not invent a new reference in the browser.
  return Number.isFinite(percent) ? Math.min(100, percent) : null
}

export function cpuCapacityDescription(snapshot?: TelemetrySnapshot): string {
  const peak = snapshot?.cpu_capacity
  return peak &&
    nonnegative(peak.peak_cores) &&
    peak.peak_cores > 0 &&
    peak.observed_since &&
    Number.isFinite(Date.parse(peak.observed_since))
    ? `100% = highest observed use (${peak.peak_cores.toFixed(3)} logical CPU) since ${new Date(peak.observed_since).toLocaleString('en')}`
    : 'Historical CPU reference unavailable · waiting for a positive sample'
}
