import { cpuCapacityDescription, cpuRelativePercent } from '@/lib/cpu-capacity'
import { TelemetryCard } from '@/components/telemetry-card'
import { lazy, Suspense } from 'react'
import { Activity, ArrowRight, Boxes, Cpu, HardDrive, MemoryStick } from 'lucide-react'
import { DataCard, EmptyState, Facts } from '@/components/data-card'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ServiceTable } from './services'
import { TaskTable } from './tasks'
import { useApi } from '@/hooks/use-api'
import { availableDiskSpace, formatBytes, formatDuration, formatPercent } from '@/lib/format'
import { latestHistoryPoint, resourceSampleIsStale, snapshotIsStale } from '@/lib/monitoring'
import type { Page, SystemInfo, TelemetrySnapshot } from '@/types'

const ResourceHistory = lazy(() => import('./resource-history'))

export function Overview({
  system,
  snapshot,
  now,
  loading,
  onPageChange,
}: {
  system?: SystemInfo
  snapshot?: TelemetrySnapshot
  now: number
  loading: boolean
  onPageChange: (page: Page) => void
}) {
  const memory = useApi('memory')
  const fs = useApi('file-system')
  const sampleStale = snapshot ? resourceSampleIsStale(snapshot, now) : false
  const latest = snapshot && !sampleStale ? latestHistoryPoint(snapshot.history, now) : undefined
  const root = fs.data?.find((row) => row.mount === '/')
  const memPercent =
    latest?.memory_percent ??
    (memory.data && memory.data.total > 0
      ? (memory.data.used / memory.data.total) * 100
      : undefined)
  const diskPercent = latest?.disk_percent ?? root?.use
  const active = snapshot?.services.filter((row) => row.state === 'active' && !row.error).length
  const total = snapshot?.services.length
  return (
    <div className="space-y-5">
      {(memory.error || fs.error) && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-300"
        >
          Some resource metrics could not refresh. The last available readings are shown; open
          System or Storage for details.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          title="CPU capacity"
          value={formatPercent(cpuRelativePercent(latest, snapshot))}
          detail={
            sampleStale
              ? 'Waiting for a current collector sample'
              : snapshot
                ? cpuRelativePercent(latest, snapshot) != null
                  ? 'Relative to peak'
                  : cpuCapacityDescription(snapshot)
                : 'Operations collector required'
          }
          info={!sampleStale && snapshot ? cpuCapacityDescription(snapshot) : undefined}
          icon={Cpu}
          progress={cpuRelativePercent(latest, snapshot)}
          loading={loading}
        />
        <MetricCard
          title="Memory usage"
          value={formatPercent(memPercent)}
          detail={
            latest?.memory_percent != null && snapshot
              ? `${formatBytes(snapshot.container.memory_working_set_bytes)} working set`
              : `${formatBytes(memory.data?.used)} of ${formatBytes(memory.data?.total)}`
          }
          icon={MemoryStick}
          progress={memPercent}
          loading={loading || memory.isPending}
        />
        <MetricCard
          title="Disk usage"
          value={formatPercent(diskPercent)}
          detail={
            root ? `${formatBytes(availableDiskSpace(root))} available on /` : 'Root filesystem'
          }
          icon={HardDrive}
          progress={diskPercent}
          loading={fs.isPending}
        />
        <MetricCard
          title="Services running"
          value={snapshot ? (total ? `${active} / ${total}` : 'Not configured') : 'Not enabled'}
          detail={
            snapshot && snapshotIsStale(snapshot, now)
              ? 'Last observed state · monitoring data is stale'
              : snapshot
                ? active === total
                  ? 'All monitored services are active'
                  : 'Some services need attention'
                : 'Port checks available in Services'
          }
          icon={Boxes}
          loading={loading}
        />
      </div>
      <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-xl" />}>
        <ResourceHistory snapshot={snapshot} now={now} />
      </Suspense>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <TelemetryCard
          title="Service health"
          description="Current status of your monitored system services."
          action={
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => onPageChange('services')}
            >
              View all
              <ArrowRight className="size-3" />
            </Button>
          }
          loading={loading}
        >
          {snapshot?.services.length ? (
            <ServiceTable
              services={[...snapshot.services]
                .sort(
                  (a, b) =>
                    Number(b.state !== 'active' || !!b.error) -
                    Number(a.state !== 'active' || !!a.error),
                )
                .slice(0, 6)}
              compact
              stale={snapshotIsStale(snapshot, now)}
            />
          ) : (
            <EmptyState
              title="No service health configured"
              description="The Services page includes your configured port checks. Enable the collector to add systemd health."
            />
          )}
        </TelemetryCard>
        <DataCard
          title="System at a glance"
          description="Operating system and available resources."
          action={<Activity className="size-4 text-muted-foreground" />}
          loading={!system && loading}
        >
          <Facts
            rows={[
              ['Hostname', system?.system.hostname || 'Unavailable'],
              [
                'Operating system',
                system ? `${system.system.distro} ${system.system.release}` : 'Unavailable',
              ],
              ['Environment', snapshot?.container.virtualization || 'Not reported'],
              [
                'Uptime',
                formatDuration(snapshot?.container.container_uptime_seconds ?? system?.time.uptime),
              ],
              [
                'Logical CPUs',
                String(snapshot?.container.cpu_count ?? system?.cpu.cores ?? 'Unavailable'),
              ],
              [
                'Memory',
                formatBytes(snapshot?.container.visible_memory_bytes ?? memory.data?.total),
              ],
              [
                'Tailscale',
                snapshot?.tailscale ? (
                  <StatusBadge
                    stale={snapshotIsStale(snapshot, now)}
                    state={
                      snapshot.tailscale.online && snapshot.tailscale.state === 'Running'
                        ? 'connected'
                        : 'unavailable'
                    }
                  />
                ) : (
                  'Not configured'
                ),
              ],
            ]}
          />
        </DataCard>
      </div>
      <TelemetryCard
        title="Recent tasks & backups"
        description="Last known results from scheduled jobs."
        action={
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => onPageChange('tasks')}
          >
            View all
            <ArrowRight className="size-3" />
          </Button>
        }
      >
        {snapshot?.jobs.length ? (
          <TaskTable
            jobs={[...snapshot.jobs]
              .sort(
                (a, b) =>
                  (Date.parse(b.last_run_at || '') || 0) - (Date.parse(a.last_run_at || '') || 0),
              )
              .slice(0, 5)}
            now={now}
            compact
            stale={snapshotIsStale(snapshot, now)}
          />
        ) : (
          <EmptyState
            title="No scheduled tasks configured"
            description="Connect systemd tasks and backup workflows through the optional collector."
          />
        )}
      </TelemetryCard>
    </div>
  )
}
