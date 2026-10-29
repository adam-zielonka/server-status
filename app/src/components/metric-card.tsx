import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MetricInfo } from '@/components/metric-info'

export function MetricCard({
  title,
  value,
  detail,
  info,
  icon: Icon,
  progress,
  loading,
  className,
}: {
  title: string
  value: string
  detail: string
  info?: string
  icon: LucideIcon
  progress?: number | null
  loading?: boolean
  className?: string
}) {
  return (
    <Card
      role="group"
      aria-label={title}
      className={cn('gap-0 border-border/80 py-0 shadow-xs', className)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
            {info && <MetricInfo label={`About ${title}`}>{info}</MetricInfo>}
          </div>
          <Icon className="size-4 text-muted-foreground/70" />
        </div>
        {loading ? (
          <Skeleton className="mb-2 h-8 w-24" />
        ) : (
          <p
            title={value}
            className="truncate text-2xl sm:text-[28px] font-semibold leading-none tracking-tight tabular-nums"
          >
            {value}
          </p>
        )}
        <p title={detail} className="mt-2 truncate text-[11px] text-muted-foreground">
          {detail}
        </p>
        {progress != null && (
          <Progress
            aria-label={title}
            value={Math.min(100, Math.max(0, progress))}
            className="mt-4 h-1"
          />
        )}
      </CardContent>
    </Card>
  )
}
