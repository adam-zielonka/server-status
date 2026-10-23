import { useEffect, useRef, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { navigation, pageFromHash } from '@/lib/navigation'
import { MonitoringIssues } from '@/components/monitoring-issues'
import { TelemetrySourceProvider } from '@/components/telemetry-card'
import { Button } from '@/components/ui/button'
import { useApi, useMetricSourceErrors } from '@/hooks/use-api'
import { formatDate } from '@/lib/format'
import { monitoringIssues } from '@/lib/monitoring'
import type { Page } from '@/types'
import { Overview } from './overview'
import { ServicesPage } from './services'
import { ProcessesPage } from './processes'
import { StoragePage } from './storage'
import { NetworkPage } from './network'
import { SystemPage } from './system'
import { TasksPage } from './tasks'

export function Dashboard() {
  const system = useApi('system')
  const telemetry = useApi('telemetry')
  const sourceErrors = useMetricSourceErrors()
  const [page, setPage] = useState<Page>(() => pageFromHash() || 'overview')
  const previousPage = useRef(page)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const onHash = () => {
      const next = pageFromHash()
      if (next) setPage(next)
    }
    const timer = setInterval(() => setNow(Date.now()), 30000)
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      clearInterval(timer)
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])
  useEffect(() => {
    document.title = `${navigation.find((item) => item.id === page)!.label} · Server Status`
    if (previousPage.current !== page) {
      document.getElementById('page-heading')?.focus({ preventScroll: true })
      document.getElementById('main-content')?.scrollIntoView({ block: 'start' })
      previousPage.current = page
    }
  }, [page])
  const snapshot = telemetry.data?.enabled ? telemetry.data : undefined
  const issues = snapshot ? monitoringIssues(snapshot, now) : []
  const issueCounts: Partial<Record<Page, number>> = {}
  for (const issue of issues) issueCounts[issue.page] = (issueCounts[issue.page] || 0) + 1
  const error = telemetry.error || system.error
  const loading = telemetry.isPending || system.isPending
  const health =
    error || sourceErrors || issues.length
      ? 'attention'
      : loading
        ? 'loading'
        : snapshot
          ? 'healthy'
          : 'basic'
  const changePage = (next: Page) => {
    if (next === page) return
    if (!pageFromHash()) window.history.replaceState(null, '', `#${page}`)
    window.history.pushState(null, '', `#${next}`)
    setPage(next)
  }
  return (
    <TelemetrySourceProvider
      value={{
        available: !!snapshot,
        pending: telemetry.isPending,
        error: telemetry.error,
        retry: () => void telemetry.refetch(),
      }}
    >
      <AppShell
        page={page}
        onPageChange={changePage}
        hostname={system.data?.system.hostname}
        health={health}
        issueCounts={issueCounts}
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
        <MonitoringIssues issues={issues} onPageChange={changePage} />
        {page === 'overview' && (
          <Overview
            system={system.data}
            snapshot={snapshot}
            now={now}
            loading={loading}
            onPageChange={changePage}
          />
        )}
        {page === 'services' && <ServicesPage snapshot={snapshot} now={now} />}
        {page === 'processes' && <ProcessesPage snapshot={snapshot} />}
        {page === 'storage' && <StoragePage snapshot={snapshot} now={now} />}
        {page === 'network' && <NetworkPage snapshot={snapshot} now={now} />}
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
    </TelemetrySourceProvider>
  )
}
