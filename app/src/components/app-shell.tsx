import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  Database,
  LogOut,
  Moon,
  RefreshCw,
  Server,
  Sun,
} from 'lucide-react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/status-badge'
import { useAuth } from '@/features/auth/auth-context'
import { isDemo } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Page } from '@/types'
import { navigateLink, navigation } from '@/lib/navigation'

function readTheme(): boolean {
  try {
    const saved = localStorage.getItem('server-status.theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function AppShell({
  page,
  onPageChange,
  hostname,
  health,
  updatedAt,
  children,
  issueCounts = {},
}: {
  page: Page
  onPageChange: (page: Page) => void
  hostname?: string
  health: string
  updatedAt?: string
  children: ReactNode
  issueCounts?: Partial<Record<Page, number>>
}) {
  const { session, signOut } = useAuth()
  const queryClient = useQueryClient()
  const fetching = useIsFetching({ queryKey: ['metrics'] }) > 0
  const [dark, setDark] = useState(readTheme)
  const active = navigation.find((item) => item.id === page)!
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('[aria-label="Mobile navigation"]')
    const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !selected) return
    const align = () => {
      if (nav.clientWidth)
        nav.scrollLeft = selected.offsetLeft - (nav.clientWidth - selected.clientWidth) / 2
    }
    align()
    const observer = new ResizeObserver(align)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [page])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('server-status.theme', dark ? 'dark' : 'light')
    } catch {
      /* Theme still works without storage. */
    }
  }, [dark])

  return (
    <div className="min-h-svh lg:pl-[224px]">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground focus:not-sr-only"
      >
        Skip to content
      </a>
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-[224px] flex-col overflow-y-auto border-r bg-card lg:flex"
        aria-label="Sidebar"
      >
        <div className="flex h-[76px] items-center gap-2.5 px-6">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4.5" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Server Status</span>
        </div>
        <div className="px-4">
          <div className="mb-7 flex items-center gap-2.5 rounded-lg border bg-background px-3 py-3">
            <div className="rounded-md border bg-card p-1.5">
              <Server className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{hostname || 'Your server'}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {isDemo ? 'Demo workspace' : 'Infrastructure'}
              </p>
            </div>
            <span
              className={cn(
                'size-1.5 rounded-full',
                health === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            />
          </div>
          <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </p>
          <nav aria-label="Main navigation" className="space-y-1">
            {navigation.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => navigateLink(event, () => onPageChange(item.id))}
                aria-current={page === item.id ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-medium transition-colors',
                  page === item.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {!!issueCounts[item.id] && (
                  <span
                    className="ml-auto rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-300"
                    aria-label={`${issueCounts[item.id]} ${issueCounts[item.id] === 1 ? 'issue' : 'issues'}`}
                  >
                    {issueCounts[item.id]}
                  </span>
                )}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <div className="rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Database className="size-3.5 text-primary" />
              {isDemo ? 'Synthetic data' : 'Live monitoring'}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {isDemo
                ? 'Explore the dashboard with example data. No real server is connected.'
                : 'Your dashboard refreshes automatically every 30 seconds.'}
            </p>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center gap-2.5 px-1">
            <div className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold uppercase">
              {session?.user.slice(0, 2) || 'SS'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{session?.user || 'Operator'}</p>
              <p className="text-[10px] text-muted-foreground">Server administrator</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label="Sign out"
                  onClick={() => signOut()}
                >
                  <LogOut className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-7">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <Activity className="mr-1 size-5 text-primary lg:hidden" />
          <span className="hidden text-muted-foreground sm:inline">Workspace</span>
          <ChevronRight className="hidden size-3 text-muted-foreground sm:inline" />
          <span className="truncate font-medium">{active.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-2 hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
            <span
              className={cn(
                'size-1.5 rounded-full',
                health === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            />
            {isDemo ? 'Demo' : 'Live'}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Refresh all metrics"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void queryClient.invalidateQueries({ queryKey: ['metrics'] })}
                disabled={fetching}
              >
                <RefreshCw className={cn('size-4', fetching && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh all metrics</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setDark((value) => !value)}
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 lg:hidden"
            aria-label="Sign out"
            onClick={() => signOut()}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <nav
        aria-label="Mobile navigation"
        className="flex gap-1 overflow-x-auto border-b bg-card px-3 py-2 lg:hidden"
      >
        {navigation.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => navigateLink(event, () => onPageChange(item.id))}
            aria-current={page === item.id ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs',
              page === item.id
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </a>
        ))}
      </nav>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto scroll-mt-20 max-w-[1600px] px-4 pb-8 pt-6 sm:px-7 sm:pt-8"
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Infrastructure
              </span>
              {isDemo && (
                <span className="rounded border bg-card px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  DEMO
                </span>
              )}
            </div>
            <h1
              id="page-heading"
              tabIndex={-1}
              className="outline-none text-2xl font-semibold tracking-tight"
            >
              {active.label === 'Overview' ? 'Server overview' : active.label}
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground">{active.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge
              state={health}
              label={
                health === 'healthy'
                  ? 'All systems operational'
                  : health === 'loading'
                    ? 'Connecting'
                    : health === 'basic'
                      ? 'Basic monitoring'
                      : 'Needs attention'
              }
            />
            {updatedAt && <p className="text-[10px] text-muted-foreground">Updated {updatedAt}</p>}
          </div>
        </div>
        {children}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-[10px] text-muted-foreground">
          <span>Server Status · Infrastructure monitoring</span>
          <a
            href="https://github.com/adam-zielonka/server-status"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-foreground"
          >
            <CircleHelp className="size-3" />
            Documentation
            <ArrowUpRight className="size-3" />
          </a>
        </footer>
      </main>
    </div>
  )
}
