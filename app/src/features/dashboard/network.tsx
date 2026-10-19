import { Globe, ShieldCheck } from 'lucide-react'
import { DataCard, EmptyState, Facts } from '@/components/data-card'
import { StatusBadge } from '@/components/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useApi } from '@/hooks/use-api'
import { showVirtualHosts } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/format'
import type { TelemetrySnapshot } from '@/types'

export function NetworkPage({ snapshot }: { snapshot?: TelemetrySnapshot }) {
  const net = useApi('net')
  const vhosts = useApi('vhosts', showVirtualHosts)
  const ts = snapshot?.tailscale
  return (
    <div className="space-y-5">
      <DataCard
        title="Network interfaces"
        description="Addresses and cumulative traffic counters for each interface."
        loading={net.isPending}
        error={net.error}
        retry={() => void net.refetch()}
        action={<Globe className="size-4 text-muted-foreground" />}
      >
        {net.data?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Interface</TableHead>
                <TableHead>Addresses</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {net.data.map((row) => (
                <TableRow key={row.iface}>
                  <TableCell className="font-mono font-medium">{row.iface}</TableCell>
                  <TableCell>
                    {row.addresses.map((address) => (
                      <span
                        key={address}
                        className="block break-all font-mono text-[11px] text-muted-foreground"
                      >
                        {address}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBytes(row.rx_bytes)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBytes(row.tx_bytes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          !net.error && (
            <EmptyState
              title="No network interfaces reported"
              description="Interface information will appear here when available."
            />
          )
        )}
      </DataCard>
      <div className="grid gap-5 xl:grid-cols-2">
        <DataCard
          title="Tailscale connection"
          description="Node status and key lifetime. Peer identities and key material are excluded."
          action={<ShieldCheck className="size-4 text-muted-foreground" />}
        >
          {ts ? (
            <>
              <Facts
                rows={[
                  [
                    'Connection',
                    <StatusBadge
                      state={
                        !ts.error && ts.state === 'Running' && ts.online
                          ? 'connected'
                          : 'unavailable'
                      }
                    />,
                  ],
                  ['DNS name', ts.dns_name || 'Unavailable'],
                  ['Addresses', ts.addresses?.join(', ') || 'Unavailable'],
                  [
                    'Node key expiry',
                    ts.error
                      ? 'Unavailable'
                      : ts.expires_at
                        ? formatDate(ts.expires_at)
                        : 'No expiry reported',
                  ],
                  [
                    'Days remaining',
                    ts.key_days_remaining == null
                      ? 'Not applicable'
                      : String(ts.key_days_remaining),
                  ],
                ]}
              />
              {ts.error && (
                <p role="alert" className="mt-3 text-xs text-destructive">
                  {ts.error}
                </p>
              )}
            </>
          ) : (
            <EmptyState
              title="Tailscale monitoring is not enabled"
              description="Enable the Tailscale source in the optional collector configuration."
            />
          )}
        </DataCard>
        <DataCard
          title="Shared routes"
          description="Services published through Tailscale Serve, including their exposure."
        >
          {ts?.services?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Paths</TableHead>
                  <TableHead>Exposure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ts.services.map((row) => (
                  <TableRow key={row.address}>
                    <TableCell className="max-w-56 whitespace-normal break-all font-mono text-[11px]">
                      {row.address}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {row.paths.join(', ')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge state={row.funnel ? 'public' : 'tailnet'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No shared routes reported"
              description="Configured Tailscale Serve routes will appear here."
            />
          )}
        </DataCard>
      </div>
      {showVirtualHosts && (
        <DataCard
          title="Virtual hosts"
          description="Caddy virtual host response codes, when Caddy is configured."
          loading={vhosts.isPending}
          error={vhosts.error}
          retry={() => void vhosts.refetch()}
        >
          {vhosts.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Local response</TableHead>
                  <TableHead>External response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vhosts.data.map((row) => (
                  <TableRow key={`${row.name}-${row.port}`}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono">{row.port}</TableCell>
                    <TableCell>
                      <StatusBadge
                        state={
                          Number(row.statusCode) >= 200 && Number(row.statusCode) < 400
                            ? 'success'
                            : 'unknown'
                        }
                        label={row.statusCode}
                      />
                    </TableCell>
                    <TableCell>{row.externalStatusCode || 'Not configured'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !vhosts.error && (
              <EmptyState
                title="No virtual hosts reported"
                description="Caddy virtual hosts will appear here when configured."
              />
            )
          )}
        </DataCard>
      )}
    </div>
  )
}
