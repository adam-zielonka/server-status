import { ArrowRight, ExternalLink, ListTodo } from 'lucide-react'
import { TelemetryCard } from '@/components/telemetry-card'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { queueIsStale, queueStatusLabels, safeQueueUrl } from '@/lib/agent-queue'
import type { AgentQueueInfo } from '@/types'

export function AgentTasks({
  queue,
  now,
  expanded = false,
  snapshotStale = false,
  onExpand,
}: {
  queue?: AgentQueueInfo | null
  now: number
  expanded?: boolean
  snapshotStale?: boolean
  onExpand?: () => void
}) {
  if (!queue) return null
  const stale = queueIsStale(queue, now) || snapshotStale
  const url = safeQueueUrl(queue.source_url)
  const counts = queue.counts
  return (
    <TelemetryCard
      title="Agent tasks"
      description="Issue counts from your task board."
      action={
        onExpand ? (
          <Button variant="ghost" size="xs" onClick={onExpand}>
            Details
            <ArrowRight className="size-3" />
          </Button>
        ) : (
          <ListTodo className="size-4 text-muted-foreground" />
        )
      }
    >
      <section aria-label="Agent task summary" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <strong className="text-2xl font-semibold tabular-nums" aria-label="Open agent tasks">
              {counts?.open ?? '—'}
            </strong>{' '}
            open issues
          </p>
          <div className="flex flex-wrap gap-2">
            {stale && <StatusBadge state="stale" label="Stale" />}
            <StatusBadge
              state={queue.status === 'ok' ? (stale ? 'stale' : 'healthy') : 'error'}
              label={
                queue.status === 'ok'
                  ? stale
                    ? 'Last read complete'
                    : 'Source up to date'
                  : queue.status === 'unavailable'
                    ? 'No data'
                    : 'Source error'
              }
            />
          </div>
        </div>
        {queue.error && (
          <p role="status" className="text-xs text-amber-800 dark:text-amber-300">
            {queue.error}
          </p>
        )}
        {!counts && (
          <p className="text-xs text-muted-foreground">
            Waiting for the first complete board read. Counts are unavailable.
          </p>
        )}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['queued', 'Queued', 'New + ready'],
              ['active', 'Active', 'Analysis + in progress + review'],
              ['waiting', 'Waiting for you', 'Your response needed'],
              ['blocked', 'Blocked', 'Technical obstacle'],
            ] as const
          ).map(([key, label, description]) => (
            <div key={key} className="min-w-0 rounded-lg border border-border/70 p-3">
              <dt className="text-xs font-medium">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{counts?.[key] ?? '—'}</dd>
              <dd className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {description}
              </dd>
            </div>
          ))}
        </dl>
        {expanded && (
          <>
            <dl
              aria-label="Agent task statuses"
              className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-3"
            >
              {Object.entries(queueStatusLabels).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 border-b border-border/60 py-2"
                >
                  <dt>{label}</dt>
                  <dd className="font-semibold tabular-nums">
                    {counts?.statuses[key as keyof typeof queueStatusLabels] ?? '—'}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Each issue is counted once. A parent and its child are two issues. Closed, completed
              and cancelled issues are excluded. Open is the sum of the four groups; queued does not
              guarantee an issue can start immediately.
            </p>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Last complete update: {formatDate(queue.last_success_at)}</span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open task board
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {expanded && (
          <p className="text-[11px] text-muted-foreground">
            Last attempt: {formatDate(queue.last_attempt_at)} · Refresh every 5 minutes · Stale
            after 15 minutes
          </p>
        )}
      </section>
    </TelemetryCard>
  )
}
