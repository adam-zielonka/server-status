import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { ApiError, fetchEndpoint } from '@/lib/api'
import type { Endpoint } from '@/types'

export function useApi<K extends Endpoint>(endpoint: K, enabled = true) {
  const { session, signOut } = useAuth()
  const query = useQuery({
    queryKey: ['metrics', endpoint],
    queryFn: ({ signal }) => fetchEndpoint(endpoint, session?.token || '', signal),
    enabled: Boolean(session) && enabled,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 1,
  })
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) signOut(query.error.message)
  }, [query.error, signOut])
  return query
}
