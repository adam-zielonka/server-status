import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  progress,
  loading,
  className,
}: {
  title: string
  value: string
  detail: string
  icon: LucideIcon
  progress?: number | null
  loading?: boolean
  className?: string
}) {
  return (
    <Card className={cn('gap-0 border-border/80 py-0 shadow-xs', className)}>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Icon className="size-4 text-muted-foreground/70" />
        </div>
        {loading ? (
          <Skeleton className="mb-2 h-8 w-24" />
        ) : (
          <p className="truncate text-[28px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </p>
        )}
        <p className="mt-2 truncate text-[11px] text-muted-foreground">{detail}</p>
        {progress != null && (
          <Progress
            aria-label={`${title} utilization`}
            value={Math.min(100, Math.max(0, progress))}
            className="mt-4 h-1"
          />
        )}
      </CardContent>
    </Card>
  )
}
