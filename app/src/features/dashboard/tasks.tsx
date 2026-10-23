import { TelemetryCard } from '@/components/telemetry-card'
import { useState } from 'react'
import { ExternalLink, Search, Timer } from 'lucide-react'
import { EmptyState } from '@/components/data-card'
import { StatusBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatDuration, safeWorkflowUrl } from '@/lib/format'
import { jobHealth, snapshotIsStale } from '@/lib/monitoring'
import type { Job, TelemetrySnapshot } from '@/types'

export function TaskTable({
  jobs,
  now,
  compact = false,
  stale = false,
}: {
  jobs: Job[]
  now: number
  compact?: boolean
  stale?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last success</TableHead>
          {!compact && (
            <>
              <TableHead>Last attempt</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Details</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((row) => {
          const url = safeWorkflowUrl(row.source_url)
          return (
            <TableRow key={row.name}>
              <TableCell className="font-medium">
                {row.name}
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  {row.kind} · {row.category || 'maintenance'}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge state={jobHealth(row, now)} stale={stale} />
                {row.timer_state && row.timer_state !== 'active' && !stale && (
                  <span className="mt-1 block">
                    <StatusBadge state="warning" label={`Scheduler ${row.timer_state}`} />
                  </span>
                )}
                {row.status === 'running' && (
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    Currently running
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(row.last_success_at)}
              </TableCell>
              {!compact && (
                <>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.last_run_at)}
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                    {row.next_run_at ? (
                      <>Next: {formatDate(row.next_run_at)}</>
                    ) : (
                      <>Success expected within {formatDuration(row.max_age_seconds)}</>
                    )}
                    {row.timer_state && (
                      <span className="mt-1 block text-[10px]">Scheduler: {row.timer_state}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                    {row.error || row.last_error || 'No error reported'}
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        View workflow
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    {row.checked_at && (
                      <span className="mt-1 block text-[10px]">
                        Checked {formatDate(row.checked_at)}
                      </span>
                    )}
                  </TableCell>
                </>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function TasksPage({ snapshot, now }: { snapshot?: TelemetrySnapshot; now: number }) {
  const [search, setSearch] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const needsAttention = (job: Job) =>
    ['failure', 'unknown', 'overdue'].includes(jobHealth(job, now)) ||
    (!!job.timer_state && job.timer_state !== 'active')
  const jobs = snapshot?.jobs || []
  const attention = jobs.filter(needsAttention).length
  const filtered = jobs
    .filter(
      (job) =>
        (!attentionOnly || needsAttention(job)) &&
        `${job.name} ${job.category || ''} ${job.kind} ${jobHealth(job, now)}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(needsAttention(b)) - Number(needsAttention(a)) || a.name.localeCompare(b.name),
    )
  return (
    <div className="space-y-5">
      <TelemetryCard
        title="Scheduled tasks & backups"
        description="Last reported results, freshness deadlines and next scheduled runs."
        action={<Timer className="size-4 text-muted-foreground" />}
      >
        {jobs.length ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  aria-label="Search tasks"
                  placeholder="Filter by name, category or status…"
                  className="h-8 pl-9 text-xs"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Button
                variant={attentionOnly ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={attentionOnly}
                onClick={() => setAttentionOnly(!attentionOnly)}
              >
                Needs attention ({attention})
              </Button>
              <span className="text-xs text-muted-foreground">
                {filtered.length} / {jobs.length} tasks
              </span>
            </div>
            {filtered.length ? (
              <TaskTable jobs={filtered} now={now} stale={snapshotIsStale(snapshot, now)} />
            ) : (
              <EmptyState
                title="No matching tasks"
                description="Try a different filter, task name or category."
              />
            )}
          </>
        ) : (
          <EmptyState
            title="No tasks configured"
            description="Add systemd tasks or GitHub Actions workflows to the private collector configuration."
          />
        )}
      </TelemetryCard>
      <div className="rounded-lg border border-primary/15 bg-primary/3 p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground">What success means</strong>
        <p className="mt-1">
          Status reflects a task or workflow result. Successful backup jobs do not verify backup
          contents or restoreability. Previous successful runs are retained when a later attempt
          fails.
        </p>
      </div>
    </div>
  )
}
