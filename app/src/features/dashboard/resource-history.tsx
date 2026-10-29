import { cpuCapacityDescription, cpuRelativePercent } from '@/lib/cpu-capacity'
import { TelemetryCard } from '@/components/telemetry-card'
import { useId, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/data-card'
import { chartHistory, hasFullHistoryWindow, latestHistoryPoint } from '@/lib/monitoring'
import { formatDuration, formatPercent } from '@/lib/format'
import type { TelemetrySnapshot } from '@/types'

const config = {
  cpu_percent: { label: 'CPU capacity', color: 'var(--chart-1)' },
  memory_percent: { label: 'Memory', color: 'var(--chart-3)' },
  disk_percent: { label: 'Disk', color: 'var(--chart-2)' },
} satisfies ChartConfig

type Series = keyof typeof config
const series = Object.keys(config) as Series[]
const patterns = { cpu_percent: undefined, memory_percent: '8 4', disk_percent: '2 4' }

function Marker({ name, x, y, color }: { name: Series; x: number; y: number; color: string }) {
  const props = { fill: 'var(--card)', stroke: color, strokeWidth: 2 }
  if (name === 'memory_percent') return <rect x={x - 3} y={y - 3} width={6} height={6} {...props} />
  if (name === 'disk_percent') return <path d={`M${x},${y - 4}l4,7h-8Z`} {...props} />
  return <circle cx={x} cy={y} r={3} {...props} />
}

function SeriesKey({ name }: { name: Series }) {
  const color = config[name].color
  return (
    <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        y1="7"
        x2="29"
        y2="7"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={patterns[name]}
      />
      <Marker name={name} x={15} y={7} color={color} />
    </svg>
  )
}

export default function ResourceHistory({
  snapshot,
  now,
}: {
  snapshot?: TelemetrySnapshot
  now: number
}) {
  const [hours, setHours] = useState('24')
  const [selected, setSelected] = useState<Series | 'all'>('all')
  const [page, setPage] = useState(0)
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const start = now - Number(hours) * 3600000
  const samples = (snapshot?.history || [])
    .map((point) => ({
      ...point,
      cpu_percent: cpuRelativePercent(point, snapshot),
      timestamp: Date.parse(point.at),
    }))
    .filter((point) => point.timestamp >= start && point.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp)
  const data = chartHistory(samples, start, now, (snapshot?.sample_interval_seconds || 60) * 3).map(
    (row) => ({ ...row, timestamp: Date.parse(row.at) }),
  )
  const observations = data.filter((row) =>
    Object.keys(config).some((key) => row[key as keyof typeof config] != null),
  )
  const recordedFor =
    observations.length > 1
      ? (observations.at(-1)!.timestamp - observations[0].timestamp) / 1000
      : 0
  const latest = latestHistoryPoint(observations, now)
  const pageCount = Math.max(1, Math.ceil(samples.length / 50))
  const currentPage = Math.min(page, pageCount - 1)
  const tableRows = [...samples].reverse().slice(currentPage * 50, (currentPage + 1) * 50)
  return (
    <TelemetryCard
      title="Resource history"
      description={`CPU relative to its observed peak; memory working set and root disk utilization. ${cpuCapacityDescription(snapshot)}`}
      action={
        <Tabs
          value={hours}
          onValueChange={(value) => {
            setHours(value)
            setPage(0)
          }}
        >
          <TabsList className="h-7">
            <TabsTrigger className="px-2.5 text-[10px]" value="1">
              1h
            </TabsTrigger>
            <TabsTrigger className="px-2.5 text-[10px]" value="6">
              6h
            </TabsTrigger>
            <TabsTrigger className="px-2.5 text-[10px]" value="24">
              24h
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      {observations.length ? (
        <>
          <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2">
            <span className="text-[11px] text-muted-foreground">Last in range</span>
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-[11px]">
                <SeriesKey name={key as Series} />
                <span className="text-muted-foreground">{value.label}</span>
                <span className="font-semibold tabular-nums">
                  {formatPercent(latest?.[key as keyof typeof config])}
                </span>
              </div>
            ))}
          </div>
          <div
            role="group"
            aria-label="Visible resource series"
            className="mb-4 flex flex-wrap gap-2"
          >
            {(['all', ...series] as const).map((name) => (
              <Button
                key={name}
                size="sm"
                variant="outline"
                aria-pressed={selected === name}
                className={
                  selected === name ? 'border-foreground font-semibold ring-1 ring-foreground' : ''
                }
                onClick={() => setSelected(name)}
              >
                {name === 'all' ? 'All series' : config[name].label}
              </Button>
            ))}
          </div>
          <ChartContainer
            id={id}
            config={config}
            className="resource-history-chart aspect-auto h-[230px] w-full"
            aria-label="CPU, memory and disk history"
          >
            <LineChart
              data={data}
              accessibilityLayer
              margin={{ top: 6, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 4" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={[start, now]}
                tickLine={false}
                axisLine={false}
                minTickGap={55}
                tickMargin={10}
                tickFormatter={(value: number) =>
                  new Date(value).toLocaleString('en', {
                    ...(hours === '24' ? { month: 'short' as const, day: 'numeric' as const } : {}),
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tickMargin={8}
                fontSize={10}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_label, payload) =>
                      new Date(Number(payload[0]?.payload?.timestamp)).toLocaleString('en')
                    }
                    formatter={(value, name) => (
                      <div className="flex min-w-28 justify-between gap-4">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <SeriesKey name={name as Series} />
                          {config[name as keyof typeof config]?.label || String(name)}
                        </span>
                        <span className="font-mono font-medium">
                          {formatPercent(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              {series
                .filter((key) => selected === 'all' || selected === key)
                .map((key) => (
                  <Line
                    key={key}
                    type="linear"
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    strokeWidth={2}
                    strokeDasharray={patterns[key]}
                    dot={({ cx, cy, index }) => (
                      <g>
                        {Number.isFinite(cx) &&
                        Number.isFinite(cy) &&
                        (index % Math.max(1, Math.ceil(data.length / 18)) === 0 ||
                          index === data.length - 1) ? (
                          <Marker name={key} x={cx!} y={cy!} color={config[key].color} />
                        ) : null}
                      </g>
                    )}
                    activeDot={({ cx, cy }) => (
                      <Marker name={key} x={cx!} y={cy!} color={config[key].color} />
                    )}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
            </LineChart>
          </ChartContainer>
          <details className="mt-4 rounded-lg border p-3">
            <summary className="cursor-pointer text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
              View recorded samples ({samples.length})
            </summary>
            <div
              role="region"
              aria-label="Recorded resource samples"
              tabIndex={0}
              className="mt-3 max-h-80 overflow-auto rounded border focus-visible:outline-2"
            >
              <table className="w-full min-w-[440px] text-left text-xs tabular-nums">
                <caption className="p-2 text-left text-muted-foreground">
                  {hours}-hour window · newest first · CPU relative to observed peak · Missing
                  values are marked Unavailable. Gaps are not interpolated.
                </caption>
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <th scope="col" className="p-2">
                      Time
                    </th>
                    {series.map((key) => (
                      <th scope="col" key={key} className="p-2">
                        {config[key].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, index) => (
                    <tr key={`${row.at}-${index}`} className="border-t">
                      <th scope="row" className="p-2 font-normal">
                        <time dateTime={row.at}>
                          {new Date(row.timestamp).toLocaleString('en')}
                        </time>
                      </th>
                      {series.map((key) => (
                        <td key={key} className="p-2">
                          {formatPercent(row[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Newer samples
              </Button>
              <span aria-live="polite">
                Page {currentPage + 1} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage + 1 >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Older samples
              </Button>
            </div>
          </details>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-[10px] text-muted-foreground">
            <span>
              {observations.length} samples · {formatDuration(recordedFor)} recorded in {hours}h
            </span>
            <span>
              {hasFullHistoryWindow(recordedFor, snapshot?.sample_interval_seconds)
                ? '24-hour rolling history'
                : `Showing the ${hours}-hour window`}{' '}
              · gaps are preserved
            </span>
          </div>
        </>
      ) : (
        <EmptyState
          title={snapshot ? 'History is collecting' : 'Resource history is not enabled'}
          description={
            snapshot
              ? 'Recorded samples will appear here after the next collector update.'
              : 'Configure the optional operations collector to record CPU, memory and disk history.'
          }
        />
      )}
    </TelemetryCard>
  )
}
