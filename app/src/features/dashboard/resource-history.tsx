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
import { EmptyState } from '@/components/data-card'
import { chartHistory, hasFullHistoryWindow, latestHistoryPoint } from '@/lib/monitoring'
import { formatDuration, formatPercent } from '@/lib/format'
import type { TelemetrySnapshot } from '@/types'

const config = {
  cpu_percent: { label: 'CPU', color: 'var(--chart-1)' },
  memory_percent: { label: 'Memory', color: 'var(--chart-3)' },
  disk_percent: { label: 'Disk', color: 'var(--chart-2)' },
} satisfies ChartConfig

export default function ResourceHistory({
  snapshot,
  now,
}: {
  snapshot?: TelemetrySnapshot
  now: number
}) {
  const [hours, setHours] = useState('24')
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const start = now - Number(hours) * 3600000
  const data = chartHistory(
    snapshot?.history || [],
    start,
    now,
    (snapshot?.sample_interval_seconds || 60) * 3,
  ).map((row) => ({ ...row, timestamp: Date.parse(row.at) }))
  const observations = data.filter((row) =>
    Object.keys(config).some((key) => row[key as keyof typeof config] != null),
  )
  const recordedFor =
    observations.length > 1
      ? (observations.at(-1)!.timestamp - observations[0].timestamp) / 1000
      : 0
  const latest = latestHistoryPoint(observations, now)
  return (
    <TelemetryCard
      title="Resource history"
      description="CPU, memory working set and root disk utilization."
      action={
        <Tabs value={hours} onValueChange={setHours}>
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
                <span className="size-2 rounded-full" style={{ background: value.color }} />
                <span className="text-muted-foreground">{value.label}</span>
                <span className="font-semibold tabular-nums">
                  {formatPercent(latest?.[key as keyof typeof config])}
                </span>
              </div>
            ))}
          </div>
          <ChartContainer
            id={id}
            config={config}
            className="aspect-auto h-[230px] w-full"
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
                        <span className="text-muted-foreground">
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
              {Object.keys(config).map((key) => (
                <Line
                  key={key}
                  type="linear"
                  dataKey={key}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  dot={data.length < 2 ? { r: 3 } : false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
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
