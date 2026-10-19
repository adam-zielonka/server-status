import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const healthy = new Set(['active', 'success', 'healthy', 'connected', 'tailnet', 'open'])
const failed = new Set(['failure', 'failed', 'public', 'error'])
const waiting = new Set(['running', 'activating', 'refreshing'])

export function StatusBadge({
  state,
  label,
  className,
}: {
  state?: string
  label?: string
  className?: string
}) {
  const value = state || 'unknown'
  const color = healthy.has(value)
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : failed.has(value)
      ? 'bg-red-500/10 text-red-700 dark:text-red-400'
      : waiting.has(value)
        ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
        : 'bg-amber-500/10 text-amber-800 dark:text-amber-400'
  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1.5 border-0 px-2 py-0.5 text-[11px] font-medium capitalize',
        color,
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {label || value}
    </Badge>
  )
}
