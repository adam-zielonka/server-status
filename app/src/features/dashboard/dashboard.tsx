import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { navigation } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { formatDate } from '@/lib/format'
import { monitoringAlerts } from '@/lib/monitoring'
import type { Page } from '@/types'
import { Overview } from './overview'
import { ServicesPage } from './services'
import { ProcessesPage } from './processes'
import { StoragePage } from './storage'
import { NetworkPage } from './network'
import { SystemPage } from './system'
import { TasksPage } from './tasks'

function currentPage(): Page {
  const hash = window.location.hash.slice(1)
  return navigation.find((item) => item.id === hash)?.id || 'overview'
}

export function Dashboard() {
  const system = useApi('system')
  const telemetry = useApi('telemetry')
  const [page, setPage] = useState<Page>(currentPage)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const onHash = () => setPage(currentPage())
    const timer = setInterval(() => setNow(Date.now()), 30000)
    window.addEventListener('hashchange', onHash)
    return () => {
      clearInterval(timer)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])
  const snapshot = telemetry.data?.enabled ? telemetry.data : undefined
  const alerts = snapshot ? monitoringAlerts(snapshot, now) : []
  const error = telemetry.error || system.error
  const loading = telemetry.isPending || system.isPending
  const health =
    error || alerts.length ? 'attention' : loading ? 'loading' : snapshot ? 'healthy' : 'basic'
  const changePage = (next: Page) => {
    setPage(next)
    window.history.replaceState(null, '', `#${next}`)
  }
  return (
    <AppShell
      page={page}
      onPageChange={changePage}
      hostname={system.data?.system.hostname}
      health={health}
      updatedAt={snapshot ? formatDate(snapshot.collected_at) : undefined}
    >
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300"
        >
          <AlertCircle className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Some monitoring data is unavailable</p>
            <p className="mt-1 leading-relaxed">
              {error.message} Existing readings may be out of date.
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Retry monitoring"
            onClick={() => {
              void telemetry.refetch()
              void system.refetch()
            }}
          >
            <RefreshCw className="size-3" />
            Retry
          </Button>
        </div>
      )}
      {alerts.length > 0 && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4"
        >
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertCircle className="size-4" />
            Needs attention
          </p>
          <ul className="space-y-1 text-xs leading-relaxed text-amber-800/90 dark:text-amber-300">
            {alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </div>
      )}
      {page === 'overview' && (
        <Overview
          system={system.data}
          snapshot={snapshot}
          now={now}
          loading={loading}
          onPageChange={changePage}
        />
      )}
      {page === 'services' && <ServicesPage snapshot={snapshot} />}
      {page === 'processes' && <ProcessesPage snapshot={snapshot} />}
      {page === 'storage' && <StoragePage snapshot={snapshot} now={now} />}
      {page === 'network' && <NetworkPage snapshot={snapshot} />}
      {page === 'system' && (
        <SystemPage
          system={system.data}
          snapshot={snapshot}
          loading={system.isPending}
          error={system.error}
        />
      )}
      {page === 'tasks' && <TasksPage snapshot={snapshot} now={now} />}
    </AppShell>
  )
}
