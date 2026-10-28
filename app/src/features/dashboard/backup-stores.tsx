import { TelemetryCard } from '@/components/telemetry-card'
import { StatusBadge } from '@/components/status-badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatBytes, formatDate, formatPercent } from '@/lib/format'
import { backupStoreIsStale } from '@/lib/monitoring'
import type { BackupStoreInfo } from '@/types'

export function BackupStores({
  stores,
  now,
  stale = false,
}: {
  stores?: BackupStoreInfo[]
  now: number
  stale?: boolean
}) {
  if (!stores?.length) return null
  return (
    <TelemetryCard
      title="Backup storage"
      description="Remote capacity and verified backup copies. Capacity warnings start at 80%; critical at 95%. Backup schedules and failures are shown in Tasks."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Storage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Used / Limit</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Utilization</TableHead>
            <TableHead>Copies</TableHead>
            <TableHead>Last verified backup</TableHead>
            <TableHead>Checked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stores.map((store) => (
            <TableRow key={store.name}>
              <TableCell className="font-medium">
                {store.name}
                {store.error && (
                  <span className="block max-w-64 whitespace-normal text-xs text-amber-700 dark:text-amber-400">
                    {store.error}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  state={store.error ? 'unknown' : store.status}
                  stale={stale || backupStoreIsStale(store, now)}
                />
              </TableCell>
              <TableCell>
                {formatBytes(store.bytes)} / {formatBytes(store.limit_bytes)}
              </TableCell>
              <TableCell>{formatBytes(store.available_bytes)}</TableCell>
              <TableCell>
                <Progress
                  value={store.used_percent ?? 0}
                  aria-label={`${store.name} backup storage utilization`}
                  className="h-1.5"
                />
                {formatPercent(store.used_percent)}
              </TableCell>
              <TableCell>{store.backup_count ?? 'Unavailable'}</TableCell>
              <TableCell>
                {formatDate(store.last_success_at)}
                {store.latest_backup_bytes !== undefined && (
                  <span className="block text-xs text-muted-foreground">
                    {formatBytes(store.latest_backup_bytes)} · verified after download
                  </span>
                )}
              </TableCell>
              <TableCell>{formatDate(store.checked_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TelemetryCard>
  )
}
