import {
  Boxes,
  PackageCheck,
  CheckCheck,
  Cpu,
  HardDrive,
  LayoutDashboard,
  Network,
  Server,
  type LucideIcon,
} from 'lucide-react'
import type { Page } from '@/types'
import type { MouseEvent } from 'react'

export function pageFromHash(hash = window.location.hash): Page | undefined {
  return navigation.find((item) => `#${item.id}` === hash)?.id
}

// Keep native open-in-new-tab and modified clicks working.
export function navigateLink(event: MouseEvent<HTMLAnchorElement>, go: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  go()
}

export const navigation: { id: Page; label: string; icon: LucideIcon; description: string }[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'A clear view of your server, in real time.',
  },
  {
    id: 'services',
    label: 'Services',
    icon: Boxes,
    description: 'Service health, uptime and listening ports.',
  },
  {
    id: 'processes',
    label: 'Processes',
    icon: Cpu,
    description: 'Understand what is using your server resources.',
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: HardDrive,
    description: 'Disk capacity, directory sizes and growth over time.',
  },
  {
    id: 'network',
    label: 'Network',
    icon: Network,
    description: 'Network interfaces, Tailscale and shared routes.',
  },
  {
    id: 'system',
    label: 'System',
    icon: Server,
    description: 'Your operating system and container allocation.',
  },
  {
    id: 'software',
    label: 'Software',
    icon: PackageCheck,
    description: 'Installed tools and available updates.',
  },
  {
    id: 'tasks',
    label: 'Tasks & backups',
    icon: CheckCheck,
    description: 'Keep track of scheduled maintenance and backups.',
  },
]
