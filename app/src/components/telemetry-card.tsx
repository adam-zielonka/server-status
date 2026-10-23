import { createContext, useContext } from 'react'
import { DataCard, type DataCardProps } from '@/components/data-card'

const TelemetrySource = createContext<{
  available: boolean
  pending: boolean
  error: Error | null
  retry: () => void
} | null>(null)

export const TelemetrySourceProvider = TelemetrySource.Provider

// Every collector section shares the parent's source state. A failed or pending
// request must not be presented as a disabled or unconfigured integration.
export function TelemetryCard({ children, ...props }: DataCardProps) {
  const source = useContext(TelemetrySource)
  const unavailable = source && !source.available
  return (
    <DataCard
      {...props}
      loading={props.loading || !!(unavailable && source.pending)}
      error={props.error || (unavailable ? source.error : null)}
      retry={props.retry || source?.retry}
    >
      {unavailable && source.error ? null : children}
    </DataCard>
  )
}
