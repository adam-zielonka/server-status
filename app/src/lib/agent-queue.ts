import type { AgentQueueInfo } from '@/types'

export function safeQueueUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.host === 'github.com' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/(users|orgs)\/[A-Za-z0-9_-]+\/projects\/[1-9][0-9]*(\/views\/[1-9][0-9]*)?$/.test(
        url.pathname,
      )
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

export function queueIsStale(queue: AgentQueueInfo, now: number): boolean {
  if (!queue.last_success_at) return false
  const at = Date.parse(queue.last_success_at)
  return queue.stale || !Number.isFinite(at) || at > now || now - at >= 900_000
}

export const queueStatusLabels = {
  new: 'New',
  ready: 'Ready',
  analysis: 'Analysis',
  in_progress: 'In progress',
  review: 'Review',
  waiting: 'Waiting for you',
  blocked: 'Blocked',
} as const
