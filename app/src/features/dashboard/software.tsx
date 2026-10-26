import { useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { TelemetryCard } from '@/components/telemetry-card'
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
import { formatDate, formatDuration } from '@/lib/format'
import { snapshotIsStale, softwareIsStale } from '@/lib/monitoring'
import type { TelemetrySnapshot } from '@/types'

export function SoftwarePage({ snapshot, now }: { snapshot?: TelemetrySnapshot; now: number }) {
  const [search, setSearch] = useState('')
  const [updatesOnly, setUpdatesOnly] = useState(false)
  const software = snapshot?.software
  const stale = !software || snapshotIsStale(snapshot, now) || softwareIsStale(software, now)
  const apt = software?.apt
  const rows = [
    ...(software?.tools || []).map((t) => ({
      ...t,
      source: `${t.source}${t.channel ? ` · ${t.channel}` : ''}`,
    })),
    ...(apt?.updates || []).map((t) => ({
      ...t,
      source: 'APT',
      status: 'update_available',
      checked_at: apt!.checked_at,
      error: apt?.error,
    })),
  ].sort(
    (a, b) =>
      Number(b.status === 'update_available') - Number(a.status === 'update_available') ||
      a.name.localeCompare(b.name),
  )
  const incomplete = !!apt?.error || rows.some((t) => t.error || t.status === 'unknown')
  const count = rows.filter((t) => t.status === 'update_available').length
  const filtered = rows.filter(
    (t) =>
      (!updatesOnly || t.status === 'update_available') &&
      `${t.name} ${t.source}`.toLowerCase().includes(search.trim().toLowerCase()),
  )
  return (
    <TelemetryCard
      title="Software & updates"
      description="Available releases for configured tools and installed APT packages."
      action={<PackageCheck className="size-4 text-muted-foreground" />}
    >
      {!software ? (
        <EmptyState
          title="Software monitoring is not configured"
          description="Enable software checks in the private collector configuration."
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Input
              aria-label="Search software"
              placeholder="Filter software…"
              className="h-8 max-w-xs text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              size="sm"
              variant={updatesOnly ? 'secondary' : 'outline'}
              aria-pressed={updatesOnly}
              onClick={() => setUpdatesOnly(!updatesOnly)}
            >
              Updates available ({count})
            </Button>
            <StatusBadge
              state={count || incomplete ? 'warning' : 'healthy'}
              label={
                count
                  ? `${count} updates available`
                  : incomplete
                    ? 'Version checks incomplete'
                    : 'No updates reported'
              }
              stale={stale}
            />
          </div>
          <div className="mb-4 space-y-1 text-xs text-muted-foreground">
            <p>
              Checked {formatDate(software.checked_at)} · Checks every{' '}
              {formatDuration(software.interval_seconds)}
            </p>
            <p>
              Node.js follows the installed major; Go follows the installed release series. Other
              tools follow their configured release channel.
            </p>
            {apt && (
              <p>
                APT uses local package indexes. Security index dated{' '}
                {formatDate(apt.security_index_at)}. Refresh indexes separately to discover newer
                packages.
              </p>
            )}
            {apt?.error && (
              <p role="alert" className="text-amber-700 dark:text-amber-400">
                {apt.error}
              </p>
            )}
            {apt && !apt.error && !apt.updates.length && (
              <p>No APT updates reported by local indexes.</p>
            )}
            {stale && (
              <p role="alert" className="text-amber-700 dark:text-amber-400">
                Update checks are stale. Current versions cannot be confirmed.
              </p>
            )}
          </div>
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Software</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Checked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={`${t.source}:${t.name}`}>
                    <TableCell className="font-medium">
                      {t.name}
                      <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                        {t.source}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.installed_version || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.available_version || '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        state={t.error ? 'unknown' : t.status === 'current' ? 'healthy' : 'warning'}
                        label={
                          t.error
                            ? 'Unknown'
                            : t.status === 'current'
                              ? 'Up to date'
                              : t.status === 'update_available'
                                ? 'Update available'
                                : 'Unknown'
                        }
                        stale={stale}
                      />
                      {t.error && (
                        <p className="mt-1 max-w-64 whitespace-normal text-[10px] text-muted-foreground">
                          {t.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(t.checked_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No matching software"
              description="Try another filter or configure tools to monitor."
            />
          )}
        </>
      )}
    </TelemetryCard>
  )
}
