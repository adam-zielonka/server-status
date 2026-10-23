import type { FileSystem } from '@/types'

// Older API builds do not expose space available to unprivileged processes.
export function availableDiskSpace(fs?: FileSystem): number | undefined {
  return fs ? (fs.available ?? Math.max(0, fs.size - fs.used)) : undefined
}

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export function formatBytes(value: unknown, digits = 1): string {
  if (!isNumber(value)) return 'Unavailable'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const index =
    value === 0
      ? 0
      : Math.min(Math.floor(Math.log(Math.abs(value)) / Math.log(1024)), units.length - 1)
  const safeIndex = Math.max(0, index)
  return `${Number((value / 1024 ** safeIndex).toFixed(digits))} ${units[safeIndex]}`
}

export function formatDuration(value: unknown, depth = 2): string {
  if (!isNumber(value) || value < 0) return 'Unavailable'
  if (value < 1) return 'Less than a second'
  let seconds = Math.floor(value)
  const parts: string[] = []
  for (const [unit, divisor] of [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ] as const) {
    const count = Math.floor(seconds / divisor)
    seconds %= divisor
    if (count) parts.push(`${count} ${unit}${count === 1 ? '' : 's'}`)
    if (parts.length >= depth) break
  }
  return parts.join(' ')
}

export function formatPercent(value: unknown): string {
  return isNumber(value) ? `${value.toFixed(1)}%` : 'Unavailable'
}

export function formatDate(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not available'
  return new Date(value).toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function safeWorkflowUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      !url.username &&
      !url.password
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}
