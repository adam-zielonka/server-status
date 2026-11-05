import { createContext, useContext } from 'react'
import { snapshotIsStale } from '@/lib/monitoring'
import type { TelemetrySnapshot } from '@/types'

export const TelemetrySource = createContext<{
  available: boolean
  pending: boolean
  error: Error | null
  retry: () => void
} | null>(null)

// Source failure takes precedence over configuration, even if cached data exists.
export function useTelemetrySource(snapshot?: TelemetrySnapshot, now?: number) {
  const source = useContext(TelemetrySource)
  const available = source?.available ?? !!snapshot
  const state = source?.error
    ? 'error'
    : !available && source?.pending
      ? 'loading'
      : !available
        ? 'disabled'
        : snapshot && now !== undefined && snapshotIsStale(snapshot, now)
          ? 'stale'
          : 'ready'
  return { ...source, available, state } as const
}
