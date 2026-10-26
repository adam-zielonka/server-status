import { TelemetryCard } from '@/components/telemetry-card'
import { DataCard, EmptyState, Facts } from '@/components/data-card'
import { Progress } from '@/components/ui/progress'
import { useApi } from '@/hooks/use-api'
import { formatBytes, formatDuration, formatPercent } from '@/lib/format'
import type { SystemInfo, TelemetrySnapshot } from '@/types'

export function SystemPage({
  system,
  snapshot,
  loading,
  error,
}: {
  system?: SystemInfo
  snapshot?: TelemetrySnapshot
  loading?: boolean
  error?: Error | null
}) {
  const memory = useApi('memory')
  const load = useApi('load-average')
  const c = snapshot?.container
  const m = memory.data
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <DataCard
        title="System information"
        description="Operating system, kernel and CPU visible to the API."
        loading={loading}
        error={error}
      >
        {system && (
          <Facts
            rows={[
              ['Hostname', system.system.hostname],
              ['Operating system', `${system.system.distro} ${system.system.release}`],
              ['Kernel', system.system.kernel],
              ['Architecture', system.system.arch],
              ['CPU', system.cpu.brand],
              ['Logical CPUs', String(system.cpu.cores)],
              ['CPU frequency', `${system.cpu.speed} GHz`],
              ['System-reported uptime', formatDuration(system.time.uptime)],
            ]}
          />
        )}
      </DataCard>
      <TelemetryCard
        title="Container & allocation"
        description={
          c?.limit_scope || 'Resource allocation reported by the optional cgroup collector.'
        }
      >
        {c ? (
          <Facts
            rows={[
              ['Virtualization', c.virtualization],
              ['Container / PID 1 uptime', formatDuration(c.container_uptime_seconds)],
              ['Kernel clock uptime', formatDuration(c.host_uptime_seconds)],
              ['Available logical CPUs', String(c.cpu_count)],
              ['CPU set', c.cpuset || 'Unavailable'],
              [
                'CPU utilization scale',
                `100% = ${c.effective_cpu_cores ?? c.cpu_count} CPU · ${c.cpu_capacity_cores != null ? 'configured capacity, bounded by visible limits' : 'visible allocation'}`,
              ],
              [
                'CPU quota',
                c.cpu_quota_cores == null
                  ? 'No finite limit visible'
                  : `${c.cpu_quota_cores} cores`,
              ],
              [
                'Memory limit',
                c.memory_limit_bytes == null
                  ? 'No finite limit visible'
                  : formatBytes(c.memory_limit_bytes),
              ],
              ['Memory visible in /proc', formatBytes(c.visible_memory_bytes)],
              ['Cgroup memory including cache', formatBytes(c.memory_current_bytes)],
              ['Memory working set', formatBytes(c.memory_working_set_bytes)],
            ]}
          />
        ) : (
          <EmptyState
            title="Container monitoring is not enabled"
            description="Configure the operations collector to inspect visible cgroup limits and PID 1 lifetime."
          />
        )}
      </TelemetryCard>
      <DataCard
        title="Memory breakdown"
        description="Memory reported by the operating system, including reclaimable cache."
        loading={memory.isPending}
        error={memory.error}
        retry={() => void memory.refetch()}
      >
        {m && (
          <>
            <div
              className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Memory: ${formatPercent((m.used / m.total) * 100)} used, ${formatPercent((m.cached / m.total) * 100)} cached`}
            >
              <span className="bg-primary" style={{ width: `${(m.used / m.total) * 100}%` }} />
              <span className="bg-violet-400" style={{ width: `${(m.cached / m.total) * 100}%` }} />
            </div>
            <Facts
              rows={[
                ['Used', formatBytes(m.used)],
                ['Cached', formatBytes(m.cached)],
                ['Free', formatBytes(m.free)],
                ['Total', formatBytes(m.total)],
                [
                  'Swap used / total',
                  m.swaptotal
                    ? `${formatBytes(m.swapused)} / ${formatBytes(m.swaptotal)}`
                    : 'No swap configured',
                ],
              ]}
            />
          </>
        )}
      </DataCard>
      <DataCard
        title="Load average"
        description="Runnable and waiting tasks, averaged over 1, 5 and 15 minutes. This is not a CPU usage percentage."
        loading={load.isPending}
        error={load.error}
        retry={() => void load.refetch()}
      >
        {load.data && (
          <div className="space-y-6 py-2">
            {load.data.map((value, index) => (
              <div key={index}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {[1, 5, 15][index]} minute{index ? 's' : ''}
                  </span>
                  <span className="font-mono font-medium">{value.toFixed(2)}</span>
                </div>
                <Progress
                  aria-label={`${[1, 5, 15][index]} minute load relative to CPU count`}
                  value={Math.min(100, (value / (c?.cpu_count || system?.cpu.cores || 1)) * 100)}
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  )
}
