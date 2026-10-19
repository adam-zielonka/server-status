import { useState } from 'react'
import { Search } from 'lucide-react'
import { DataCard, EmptyState } from '@/components/data-card'
import { StatusBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useApi } from '@/hooks/use-api'
import { formatDate, formatDuration } from '@/lib/format'
import type { ServiceHealth, TelemetrySnapshot } from '@/types'

export function ServiceTable({
  services,
  compact = false,
}: {
  services: ServiceHealth[]
  compact?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Uptime</TableHead>
          {!compact && (
            <>
              <TableHead className="text-right">Restarts</TableHead>
              <TableHead>Last observed error</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              {row.name}
              {!compact && (
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  {row.unit} · {row.scope}
                </span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge state={row.state} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDuration(row.uptime_seconds)}
            </TableCell>
            {!compact && (
              <>
                <TableCell className="text-right tabular-nums">{row.restarts ?? '—'}</TableCell>
                <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                  {row.error || row.last_error || 'None observed'}
                  {row.last_error_at && (
                    <span className="mt-1 block text-[10px]">{formatDate(row.last_error_at)}</span>
                  )}
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function ServicesPage({ snapshot }: { snapshot?: TelemetrySnapshot }) {
  const [search, setSearch] = useState('')
  const ports = useApi('services')
  const services =
    snapshot?.services.filter((row) =>
      `${row.name} ${row.unit}`.toLowerCase().includes(search.toLowerCase()),
    ) || []
  return (
    <div className="space-y-5">
      <DataCard
        title="System services"
        description="Read-only systemd health. Last errors are retained once observed."
        action={
          <StatusBadge
            state="active"
            label={`${snapshot?.services.filter((s) => s.state === 'active').length || 0} active`}
          />
        }
      >
        {snapshot ? (
          <>
            <div className="relative mb-4 max-w-xs">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                aria-label="Search services"
                placeholder="Search services…"
                className="h-8 pl-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {services.length ? (
              <ServiceTable services={services} />
            ) : (
              <EmptyState
                title="No matching services"
                description="Try a different service name or unit."
              />
            )}
          </>
        ) : (
          <EmptyState
            title="Service health is not enabled"
            description="Configure systemd units in the optional operations collector. Port checks are available below."
          />
        )}
      </DataCard>
      <DataCard
        title="Port availability"
        description="An open port confirms connectivity; systemd provides the service health above. Local-only services may intentionally be closed on other addresses."
        loading={ports.isPending}
        error={ports.error}
        retry={() => void ports.refetch()}
      >
        {ports.data?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Host checks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ports.data.map((row, i) => (
                <TableRow key={`${row.name}-${row.port}-${i}`}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{row.port}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {row.hosts.map((host) => (
                        <StatusBadge
                          key={host.name}
                          state={host.open ? 'open' : 'closed'}
                          label={host.name}
                        />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          !ports.error && (
            <EmptyState
              title="No port checks configured"
              description="Add services and hosts to your private API configuration."
            />
          )
        )}
      </DataCard>
    </div>
  )
}
