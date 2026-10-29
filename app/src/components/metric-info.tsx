import { useState } from 'react'
import { Info } from 'lucide-react'
import { Popover } from 'radix-ui'

export function MetricInfo({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch') setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={(event) => {
            event.preventDefault()
            setOpen(true)
          }}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          side="top"
          align="start"
          sideOffset={4}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-50 max-w-[min(20rem,calc(100vw-1.5rem))] rounded-md border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
