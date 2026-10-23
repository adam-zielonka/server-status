import { TelemetryCard } from '@/components/telemetry-card'
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
import { snapshotIsStale } from '@/lib/monitoring'
import type { TelemetrySnapshot } from '@/types'

function HttpStatus({ code }: { code: string }) {
  const value = Number(code)
  return (
    <StatusBadge
      state={value >= 200 && value < 400 ? 'success' : value >= 400 ? 'failure' : 'unknown'}
      label={value === 0 ? 'Not reachable' : code}
    />
  )
}

export function NetworkPage({ snapshot, now }: { snapshot?: TelemetrySnapshot; now: number }) {
  const net = useApi('net')
  const vhosts = useApi('vhosts', showVirtualHosts)
  const ts = snapshot?.tailscale
  const stale = snapshotIsStale(snapshot, now)
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
      <TelemetryCard
        title="Cloudflare Tunnels"
        description="Local connector readiness and active edge connections. This does not verify application availability. Counters reset when the connector restarts."
        action={<ShieldCheck className="size-4 text-muted-foreground" />}
      >
        {snapshot?.tunnels?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tunnel / hostnames</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Connections</TableHead>
                <TableHead>Edge locations</TableHead>
                <TableHead className="text-right">Requests / errors</TableHead>
                <TableHead>Last checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.tunnels.map((tunnel) => (
                <TableRow key={tunnel.name}>
                  <TableCell className="max-w-64 whitespace-normal">
                    <span className="font-medium">{tunnel.name}</span>
                    {tunnel.hostnames.map((hostname) => (
                      <span
                        key={hostname}
                        className="block break-all font-mono text-[11px] text-muted-foreground"
                      >
                        {hostname}
                      </span>
                    ))}
                    {tunnel.error && (
                      <span role="alert" className="block text-xs text-destructive">
                        {tunnel.error}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge state={tunnel.error ? 'unknown' : tunnel.status} stale={stale} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {tunnel.connections == null
                      ? 'Unavailable'
                      : `${tunnel.connections} / ${tunnel.expected_connections}`}
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {tunnel.locations?.join(', ') || 'Unavailable'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {tunnel.requests?.toLocaleString() ?? '—'} /{' '}
                    {tunnel.request_errors?.toLocaleString() ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(tunnel.checked_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No Cloudflare Tunnels configured"
            description="Configured local connectors will appear here when tunnel monitoring is enabled."
          />
        )}
      </TelemetryCard>
      <div className="grid gap-5 xl:grid-cols-2">
        <TelemetryCard
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
                      stale={stale}
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
        </TelemetryCard>
        <TelemetryCard
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
        </TelemetryCard>
      </div>
      {showVirtualHosts && (
        <DataCard
          title="Virtual hosts"
          description="Caddy listener responses before redirects. Local checks connect directly to loopback; external checks use the configured checker."
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
                      <HttpStatus code={row.statusCode} />
                    </TableCell>
                    <TableCell>
                      {row.externalStatusCode && row.externalStatusCode !== 'Need setup' ? (
                        <HttpStatus code={row.externalStatusCode} />
                      ) : (
                        'Not configured'
                      )}
                    </TableCell>
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
