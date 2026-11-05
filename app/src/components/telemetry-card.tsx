import { useTelemetrySource, TelemetrySource } from '@/hooks/use-telemetry-source'
import { DataCard, type DataCardProps } from '@/components/data-card'

export const TelemetrySourceProvider = TelemetrySource.Provider

// Every collector section shares the parent's source state. A failed or pending
// request must not be presented as a disabled or unconfigured integration.
export function TelemetryCard({ children, ...props }: DataCardProps) {
  const source = useTelemetrySource()
  const unavailable = !source.available
  return (
    <DataCard
      {...props}
      loading={props.loading || !!(unavailable && source.state === 'loading')}
      error={props.error || source.error}
      retry={props.retry || source.retry}
    >
      {unavailable && source.error ? null : children}
    </DataCard>
  )
}
