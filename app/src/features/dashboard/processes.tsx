import { useState } from 'react'
import { Search } from 'lucide-react'
import { DataCard, EmptyState } from '@/components/data-card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatBytes, formatPercent } from '@/lib/format'
import type { TelemetrySnapshot } from '@/types'

export function ProcessesPage({ snapshot }: { snapshot?: TelemetrySnapshot }) {
  const [sort, setSort] = useState('top_memory')
  const [search, setSearch] = useState('')
  const rows =
    (sort === 'top_cpu' ? snapshot?.processes.top_cpu : snapshot?.processes.top_memory)?.filter(
      (row) => `${row.name} ${row.pid}`.toLowerCase().includes(search.toLowerCase()),
    ) || []
  return (
    <DataCard
      title="Top processes"
      description="100% CPU equals one logical CPU. Only process names and resource counters are collected."
      action={
        <Tabs value={sort} onValueChange={setSort}>
          <TabsList className="h-7">
            <TabsTrigger value="top_memory" className="px-2.5 text-[10px]">
              Memory
            </TabsTrigger>
            <TabsTrigger value="top_cpu" className="px-2.5 text-[10px]">
              CPU
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      {!snapshot ? (
        <EmptyState
          title="Process monitoring is not enabled"
          description="Configure the optional operations collector to inspect CPU and resident memory usage."
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-9 text-xs"
                aria-label="Search processes"
                placeholder="Filter by name or PID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {snapshot.processes.sample_seconds}-second CPU sample · top 10
            </p>
          </div>
          {rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Process</TableHead>
                  <TableHead>PID</TableHead>
                  <TableHead className="text-right">CPU usage</TableHead>
                  <TableHead className="text-right">Resident memory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.pid}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{row.pid}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPercent(row.cpu_percent)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatBytes(row.rss_bytes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No matching processes"
              description="Try a different process name or PID."
            />
          )}
          <p className="mt-4 border-t pt-3 text-[10px] leading-relaxed text-muted-foreground">
            Point-in-time usage, refreshed automatically. New processes may have no CPU estimate.
            Arguments and environment variables are never collected.
          </p>
        </>
      )}
    </DataCard>
  )
}
