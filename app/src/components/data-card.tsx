import type { ReactNode } from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface DataCardProps {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
  className?: string
  loading?: boolean
  error?: Error | null
  retry?: () => void
}
export function DataCard({
  title,
  description,
  children,
  action,
  className,
  loading,
  error,
  retry,
}: DataCardProps) {
  return (
    <Card
      className={cn('min-w-0 gap-0 overflow-hidden border-border/80 py-0 shadow-xs', className)}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="min-w-0 flex-1 basis-48">
          <CardTitle role="heading" aria-level={2} className="text-sm font-semibold tracking-tight">
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="mt-1 text-xs leading-relaxed">
              {description}
            </CardDescription>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className="p-5">
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">{error.message}</span>
            {retry && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={retry}
                aria-label={`Retry ${title}`}
              >
                <RefreshCw className="size-3" />
              </Button>
            )}
          </div>
        )}
        {loading ? (
          <div aria-label={`Loading ${title}`} className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <div className="mb-1 rounded-lg border bg-muted/50 p-2.5">
        <Inbox className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-border/60">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-4"
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-xs font-medium sm:text-right">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
