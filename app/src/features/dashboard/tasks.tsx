import { ExternalLink, Timer } from 'lucide-react'
import { DataCard, EmptyState } from '@/components/data-card'
import { StatusBadge } from '@/components/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatDuration, safeWorkflowUrl } from '@/lib/format'
import { jobHealth } from '@/lib/monitoring'
import type { Job, TelemetrySnapshot } from '@/types'

export function TaskTable({
  jobs,
  now,
  compact = false,
}: {
  jobs: Job[]
  now: number
  compact?: boolean
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
                <StatusBadge state={jobHealth(row, now)} />
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
  return (
    <div className="space-y-5">
      <DataCard
        title="Scheduled tasks & backups"
        description="Last reported results, freshness deadlines and next scheduled runs."
        action={<Timer className="size-4 text-muted-foreground" />}
      >
        {snapshot?.jobs.length ? (
          <TaskTable jobs={snapshot.jobs} now={now} />
        ) : (
          <EmptyState
            title="No tasks configured"
            description="Add systemd tasks or GitHub Actions workflows to the private collector configuration."
          />
        )}
      </DataCard>
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
