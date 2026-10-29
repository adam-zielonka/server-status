import { TelemetryCard } from '@/components/telemetry-card'
import { useState } from 'react'
import { HardDrive, FolderOpen } from 'lucide-react'
import { DataCard, EmptyState } from '@/components/data-card'
import { StatusBadge } from '@/components/status-badge'
import { MetricCard } from '@/components/metric-card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useApi } from '@/hooks/use-api'
import { availableDiskSpace, formatBytes, formatDate, formatPercent } from '@/lib/format'
import { directoryGrowth, snapshotIsStale } from '@/lib/monitoring'
import type { TelemetrySnapshot } from '@/types'
import { BackupStores } from './backup-stores'

const databaseSize = (bytes?: number) =>
  bytes === undefined ? 'Unavailable' : `${Number((bytes / 1_000_000).toFixed(1))} MB`

export function StoragePage({ snapshot, now }: { snapshot?: TelemetrySnapshot; now: number }) {
  const fs = useApi('file-system')
  const [hours, setHours] = useState('24')
  const root = fs.data?.find((row) => row.mount === '/')
  const history =
    snapshot?.history.filter(
      (row) => Date.parse(row.at) >= now - Number(hours) * 3600000 && Date.parse(row.at) <= now,
    ) || []
  const filesystems = fs.data?.filter((row) => !row.mount.startsWith('/snap/'))
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Root disk"
          value={formatBytes(root?.size)}
          detail={root ? `${root.type} · ${root.mount}` : 'Filesystem capacity'}
          icon={HardDrive}
          loading={fs.isPending}
        />
        <MetricCard
          title="Used space"
          value={formatBytes(root?.used)}
          detail={
            root ? `${formatPercent(root.use)} of root disk` : 'Waiting for filesystem metrics'
          }
          progress={root?.use}
          icon={HardDrive}
          loading={fs.isPending}
        />
        <MetricCard
          title="Available space"
          value={formatBytes(availableDiskSpace(root))}
          detail="Root filesystem"
          icon={FolderOpen}
          loading={fs.isPending}
        />
      </div>
      <DataCard
        title="Filesystems"
        description="Capacity and usage per mount. Snap package mounts are excluded."
        loading={fs.isPending}
        error={fs.error}
        retry={() => void fs.refetch()}
      >
        {filesystems?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mount</TableHead>
                <TableHead>Filesystem</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Available</TableHead>
                <TableHead className="min-w-28">Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filesystems.map((row) => (
                <TableRow key={`${row.fs}-${row.mount}`}>
                  <TableCell className="font-mono font-medium">{row.mount}</TableCell>
                  <TableCell className="text-muted-foreground">{row.type}</TableCell>
                  <TableCell>{formatBytes(row.size)}</TableCell>
                  <TableCell>{formatBytes(row.used)}</TableCell>
                  <TableCell>{formatBytes(availableDiskSpace(row))}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={row.use}
                        aria-label={`${row.mount} disk utilization`}
                        className="h-1.5"
                      />
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {formatPercent(row.use)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          !fs.error && (
            <EmptyState
              title="No filesystems reported"
              description="Mounted filesystems will appear here when available."
            />
          )
        )}
      </DataCard>
      {!!snapshot?.databases?.length && (
        <TelemetryCard
          title="Databases"
          description="Shared database capacity across all projects. Alerts start at 80% usage; critical at 95%. Limits are configured by the operator; 1 MB = 1,000,000 bytes."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Database</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Used / Limit</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Connections</TableHead>
                <TableHead>TLS / Latency</TableHead>
                <TableHead>Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.databases.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">
                    {row.name}
                    {row.error && (
                      <span className="block text-xs text-amber-800 dark:text-amber-300">
                        {row.error}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      state={row.error ? 'unknown' : row.status}
                      stale={snapshotIsStale(snapshot, now)}
                    />
                  </TableCell>
                  <TableCell>
                    {databaseSize(row.bytes)} / {databaseSize(row.limit_bytes)}
                  </TableCell>
                  <TableCell>{databaseSize(row.available_bytes)}</TableCell>
                  <TableCell>
                    <Progress
                      value={row.used_percent ?? 0}
                      aria-label={`${row.name} database utilization`}
                      className="h-1.5"
                    />
                    {formatPercent(row.used_percent)}
                  </TableCell>
                  <TableCell>{row.connections ?? 'Unavailable'}</TableCell>
                  <TableCell>
                    {row.tls === undefined ? 'Unavailable' : row.tls ? 'TLS' : 'Unencrypted'} /{' '}
                    {row.latency_ms === undefined ? 'Unavailable' : `${row.latency_ms} ms`}
                  </TableCell>
                  <TableCell>{formatDate(row.checked_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TelemetryCard>
      )}
      <BackupStores
        stores={snapshot?.backup_stores}
        now={now}
        stale={snapshotIsStale(snapshot, now)}
      />
      <TelemetryCard
        title="Directory growth"
        description="Allocated bytes, scanned periodically without reading file contents. Growth compares recorded observations."
        action={
          <Tabs value={hours} onValueChange={setHours}>
            <TabsList className="h-7">
              <TabsTrigger value="1" className="px-2 text-[10px]">
                1h
              </TabsTrigger>
              <TabsTrigger value="6" className="px-2 text-[10px]">
                6h
              </TabsTrigger>
              <TabsTrigger value="24" className="px-2 text-[10px]">
                24h
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        {snapshot?.directories.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Directory</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Change in {hours}h</TableHead>
                <TableHead className="text-right">Last scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.directories.map((row) => {
                const growth = directoryGrowth(history, row.name)
                return (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">
                      {row.name}
                      {row.error && (
                        <span className="mt-1 block max-w-64 whitespace-normal text-[10px] text-amber-800 dark:text-amber-300">
                          {row.error}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatBytes(row.bytes)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {growth === null
                        ? 'Collecting baseline'
                        : `${growth > 0 ? '+' : ''}${formatBytes(growth)}`}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(row.collected_at)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No directories configured"
            description="Add directory labels and paths to the private collector configuration to track disk growth."
          />
        )}
      </TelemetryCard>
    </div>
  )
}
