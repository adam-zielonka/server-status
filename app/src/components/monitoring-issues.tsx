import { useState } from 'react'
import { AlertCircle, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { navigateLink, navigation } from '@/lib/navigation'
import type { MonitoringIssue } from '@/lib/monitoring'
import type { Page } from '@/types'

export function MonitoringIssues({
  issues,
  onPageChange,
}: {
  issues: MonitoringIssue[]
  onPageChange: (page: Page) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (!issues.length) return null
  const critical = issues.filter((issue) => issue.severity === 'critical').length
  return (
    <section
      aria-label="Monitoring issues"
      className="mb-5 overflow-hidden rounded-lg border border-amber-500/25 bg-amber-500/5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/15 px-4 py-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <AlertCircle className="size-4" />
          {issues.length} {issues.length === 1 ? 'issue needs' : 'issues need'} attention
        </h2>
        {critical > 0 && (
          <span className="text-xs font-medium text-destructive">{critical} critical</span>
        )}
      </div>
      <ul className="divide-y divide-amber-500/10">
        {(expanded ? issues : issues.slice(0, 4)).map((issue) => (
          <li key={issue.id}>
            <a
              href={`#${issue.page}`}
              onClick={(event) => navigateLink(event, () => onPageChange(issue.page))}
              className="flex items-start gap-3 px-4 py-3 text-xs hover:bg-amber-500/5 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span
                aria-hidden="true"
                className={`mt-1 size-1.5 shrink-0 rounded-full ${issue.severity === 'critical' ? 'bg-destructive' : 'bg-amber-500'}`}
              />
              <span className="min-w-0 flex-1 break-words">{issue.message}</span>
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <span className="hidden sm:inline">
                  {navigation.find((item) => item.id === issue.page)?.label}
                </span>
                <ArrowUpRight className="size-3.5" />
              </span>
            </a>
          </li>
        ))}
      </ul>
      {issues.length > 4 && (
        <Button
          variant="ghost"
          size="sm"
          className="m-2 text-xs"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show fewer issues' : `Show all ${issues.length} issues`}
        </Button>
      )}
    </section>
  )
}
