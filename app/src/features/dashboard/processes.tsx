import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
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
import type { ProcessInfo, TelemetrySnapshot } from '@/types'

export function ProcessesPage({ snapshot }: { snapshot?: TelemetrySnapshot }) {
  const [view, setView] = useState('instances')
  const [sort, setSort] = useState('top_memory')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const allProcesses =
    sort === 'top_cpu' ? snapshot?.processes.top_cpu : snapshot?.processes.top_memory
  const byPid = new Map(allProcesses?.map((process) => [process.pid, process]))
  const members = (row: ProcessInfo) =>
    (row.member_pids || [])
      .map((pid) => byPid.get(pid))
      .filter((process): process is ProcessInfo => !!process)
      .sort((a, b) =>
        sort === 'top_cpu'
          ? (b.cpu_percent || 0) - (a.cpu_percent || 0) || a.pid - b.pid
          : b.rss_bytes - a.rss_bytes || a.pid - b.pid,
      )
  const matches = (row: ProcessInfo) =>
    `${row.name} ${row.pid} ${row.service || ''} ${row.parent_name || ''} ${row.instance_pid || ''} ${row.instance_name || ''} ${row.browser_instance_pid || ''} ${row.member_pids?.join(' ') || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  const toggle = (pid: number) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  const grouped = view === 'instances' && !!snapshot?.processes.groups_memory
  const source = grouped
    ? sort === 'top_cpu'
      ? snapshot?.processes.groups_cpu
      : snapshot?.processes.groups_memory
    : sort === 'top_cpu'
      ? snapshot?.processes.top_cpu
      : snapshot?.processes.top_memory
  const rows =
    source?.filter((row) => matches(row) || (grouped && members(row).some(matches))) || []
  return (
    <DataCard
      title="Processes"
      description="Processes include browsers launched by their service or application. 100% CPU equals one logical CPU."
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
            <Tabs value={view} onValueChange={setView}>
              <TabsList className="h-8">
                <TabsTrigger value="instances">Services & instances</TabsTrigger>
                <TabsTrigger value="individual">Individual processes</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-9 text-xs"
                aria-label="Search processes"
                placeholder="Filter by name, PID or service…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {snapshot.processes.sample_seconds}-second CPU sample · {rows.length} /{' '}
              {source?.length || 0} {grouped ? 'groups' : 'processes'}
            </p>
          </div>
          {rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Process</TableHead>
                  <TableHead>{grouped ? 'Group PID / processes' : 'PID / group'}</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead className="text-right">CPU usage</TableHead>
                  <TableHead className="text-right">
                    {grouped ? 'Summed RSS' : 'Resident memory'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <Fragment key={row.pid}>
                    <TableRow>
                      <TableCell className="font-medium">
                        {grouped ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left hover:underline"
                            aria-label={`Processes in ${row.name} (${row.pid})`}
                            aria-expanded={expanded.has(row.pid)}
                            aria-controls={`group-members-${row.pid}`}
                            onClick={() => toggle(row.pid)}
                          >
                            {expanded.has(row.pid) ? (
                              <ChevronDown className="size-4 shrink-0" />
                            ) : (
                              <ChevronRight className="size-4 shrink-0" />
                            )}
                            {row.name}
                          </button>
                        ) : (
                          row.name
                        )}
                        {grouped && row.group_kind ? (
                          <div className="text-xs font-normal text-muted-foreground">
                            {row.group_kind === 'service'
                              ? 'Service'
                              : row.group_kind === 'browser'
                                ? 'Browser instance'
                                : 'Process tree'}
                          </div>
                        ) : null}
                        {grouped && !!row.browser_instance_count ? (
                          <div className="text-xs font-normal text-muted-foreground">
                            Includes {row.browser_instance_count} browser instances
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {row.pid}
                        {grouped ? (
                          <div className="text-xs" title={`PIDs: ${row.member_pids?.join(', ')}`}>
                            {row.process_count} processes
                          </div>
                        ) : row.instance_pid && row.instance_pid !== row.pid ? (
                          <div className="text-xs">
                            {row.group_kind === 'service' || row.browser_instance_pid
                              ? 'Group'
                              : 'Instance'}{' '}
                            {row.instance_pid}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{row.service || 'Service unavailable'}</div>
                        {!grouped && row.browser_instance_pid ? (
                          <div>Browser instance {row.browser_instance_pid}</div>
                        ) : null}
                        {row.ppid ? (
                          <div>
                            Parent: {row.parent_name || 'unknown'} ({row.ppid})
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(row.cpu_percent)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBytes(row.rss_bytes)}
                      </TableCell>
                    </TableRow>
                    {grouped && expanded.has(row.pid) ? (
                      <TableRow id={`group-members-${row.pid}`}>
                        <TableCell colSpan={5} className="bg-muted/30 p-4">
                          <p className="mb-2 text-xs text-muted-foreground">
                            {members(row).length} member processes · sorted by{' '}
                            {sort === 'top_cpu' ? 'CPU' : 'memory'}
                          </p>
                          <Table aria-label={`Members of ${row.name} (${row.pid})`}>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Process</TableHead>
                                <TableHead>PID</TableHead>
                                <TableHead>Parent / browser instance</TableHead>
                                <TableHead className="text-right">CPU usage</TableHead>
                                <TableHead className="text-right">Resident memory</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {members(row).map((member) => (
                                <TableRow key={member.pid}>
                                  <TableCell>{member.name}</TableCell>
                                  <TableCell className="font-mono">{member.pid}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {member.ppid ? (
                                      <div>
                                        Parent: {member.parent_name || 'unknown'} ({member.ppid})
                                      </div>
                                    ) : null}
                                    {member.browser_instance_pid ? (
                                      <div>Browser instance {member.browser_instance_pid}</div>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatPercent(member.cpu_percent)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatBytes(member.rss_bytes)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
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
            Point-in-time usage, refreshed automatically. Service totals include their browser
            instances. Without a service, browsers join their observed launching application; other
            processes follow same-executable ancestry. All observed processes and groups are listed,
            with each process counted once. Expand a group to inspect its members. Summed RSS may
            count shared memory more than once. Missing ancestors cannot be reconstructed.
            Incomplete CPU samples show no estimate. Arguments and environment variables are never
            collected.
          </p>
        </>
      )}
    </DataCard>
  )
}
