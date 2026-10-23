import { expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProcessesPage } from './processes'
import { demoTelemetry } from '@/lib/demo'

it('shows separate browser instances, searches by child PID, and switches to individual processes', async () => {
  const user = userEvent.setup()
  const snapshot = demoTelemetry()
  snapshot.processes.groups_memory = [
    {
      pid: 400,
      name: 'chrome',
      rss_bytes: 300,
      cpu_percent: 2,
      process_count: 2,
      member_pids: [400, 401],
      service: 'example.service',
      ppid: 100,
      parent_name: 'node',
    },
    {
      pid: 500,
      name: 'chrome',
      rss_bytes: 200,
      cpu_percent: null,
      process_count: 1,
      member_pids: [500],
    },
  ]
  snapshot.processes.groups_cpu = [...snapshot.processes.groups_memory].reverse()
  snapshot.processes.top_memory = [
    {
      pid: 401,
      name: 'chrome-renderer',
      rss_bytes: 100,
      cpu_percent: 1,
      instance_pid: 400,
      ppid: 400,
      parent_name: 'chrome',
      service: 'example.service',
    },
  ]
  render(<ProcessesPage snapshot={snapshot} />)
  expect(screen.getAllByText('chrome')).toHaveLength(2)
  expect(screen.getByText('2 processes')).toHaveAttribute('title', 'PIDs: 400, 401')
  expect(screen.getByText('Parent: node (100)')).toBeInTheDocument()
  const filter = screen.getByRole('textbox', { name: 'Search processes' })
  await user.type(filter, '401')
  expect(screen.getAllByText('chrome')).toHaveLength(1)
  await user.clear(filter)
  await user.click(screen.getByRole('tab', { name: 'Individual processes' }))
  expect(screen.getByText('chrome-renderer')).toBeInTheDocument()
  expect(screen.getByText('Instance 400')).toBeInTheDocument()
})

it('identifies service groups and filters by their name in individual view', async () => {
  const user = userEvent.setup()
  const snapshot = demoTelemetry()
  snapshot.processes.groups_memory = [
    {
      pid: 700,
      name: 'example.service',
      browser_instance_count: 2,
      group_kind: 'service',
      rss_bytes: 300,
      cpu_percent: 4,
      process_count: 3,
      member_pids: [700, 701, 702],
      service: 'example.service',
    },
  ]
  snapshot.processes.top_memory = [
    {
      pid: 702,
      name: 'worker',
      browser_instance_pid: 701,
      rss_bytes: 100,
      cpu_percent: 1,
      instance_pid: 700,
      instance_name: 'example.service',
      group_kind: 'service',
    },
  ]
  render(<ProcessesPage snapshot={snapshot} />)
  expect(screen.getByText('Service')).toBeInTheDocument()
  expect(screen.getByText('3 processes')).toBeInTheDocument()
  expect(screen.getByText('Includes 2 browser instances')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Individual processes' }))
  await user.type(screen.getByRole('textbox', { name: 'Search processes' }), 'example.service')
  expect(screen.getByText('worker')).toBeInTheDocument()
  expect(screen.getByText('Group 700')).toBeInTheDocument()
  expect(screen.getByText('Browser instance 701')).toBeInTheDocument()
})

it('lists every group, expands its full members, sorts them and updates expanded rows on refresh', async () => {
  const user = userEvent.setup()
  const snapshot = demoTelemetry()
  const groups = Array.from({ length: 12 }, (_, i) => ({
    pid: 800 + i * 10,
    name: `test-${i}.service`,
    rss_bytes: 300,
    cpu_percent: 3,
    process_count: 2,
    member_pids: [800 + i * 10, 801 + i * 10],
    group_kind: 'service' as const,
  }))
  const processes = groups.flatMap((group) =>
    group.member_pids.map((pid, i) => ({
      pid,
      name: `worker-${pid}`,
      instance_pid: group.pid,
      rss_bytes: i ? 100 : 200,
      cpu_percent: i ? 2 : 1,
      ppid: i ? group.pid : 1,
    })),
  )
  snapshot.processes.groups_memory = groups
  snapshot.processes.groups_cpu = groups
  snapshot.processes.top_memory = processes
  snapshot.processes.top_cpu = processes
  const { rerender } = render(<ProcessesPage snapshot={snapshot} />)
  expect(screen.getAllByRole('button', { name: /^Processes in/ })).toHaveLength(12)
  const toggle = screen.getByRole('button', { name: 'Processes in test-11.service (910)' })
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  let table = within(screen.getByRole('table', { name: 'Members of test-11.service (910)' }))
  expect(table.getAllByRole('row')).toHaveLength(3)
  expect(table.getAllByRole('row')[1]).toHaveTextContent('worker-910')
  await user.click(screen.getByRole('tab', { name: 'CPU' }))
  table = within(screen.getByRole('table', { name: 'Members of test-11.service (910)' }))
  expect(table.getAllByRole('row')[1]).toHaveTextContent('worker-911')
  processes[processes.length - 1].name = 'refreshed-worker'
  rerender(<ProcessesPage snapshot={{ ...snapshot }} />)
  expect(table.getByText('refreshed-worker')).toBeInTheDocument()
  await user.click(toggle)
  expect(
    screen.queryByRole('table', { name: 'Members of test-11.service (910)' }),
  ).not.toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'Search processes' }), 'refreshed-worker')
  expect(screen.getAllByRole('button', { name: /^Processes in/ })).toHaveLength(1)
  await user.clear(screen.getByRole('textbox', { name: 'Search processes' }))
  await user.click(screen.getByRole('tab', { name: 'Individual processes' }))
  expect(screen.getAllByRole('row')).toHaveLength(25)
})

it('pages large rankings while searching the entire list and resets the page after filtering', async () => {
  const user = userEvent.setup()
  const snapshot = demoTelemetry()
  const rows = Array.from({ length: 121 }, (_, index) => ({
    pid: 1000 + index,
    name: `worker-${index}`,
    rss_bytes: 121 - index,
    cpu_percent: index,
  }))
  snapshot.processes.top_memory = rows
  render(<ProcessesPage snapshot={snapshot} />)
  await user.click(screen.getByRole('tab', { name: 'Individual processes' }))
  expect(screen.getAllByRole('row')).toHaveLength(51)
  expect(screen.getByText('1–50 of 121 processes')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByText('51–100 of 121 processes')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getAllByRole('row')).toHaveLength(22)
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  await user.type(screen.getByRole('textbox', { name: 'Search processes' }), 'worker-120')
  expect(screen.getAllByRole('row')).toHaveLength(2)
  expect(screen.getByText('worker-120')).toBeInTheDocument()
  await user.clear(screen.getByRole('textbox', { name: 'Search processes' }))
  expect(screen.getByText('1–50 of 121 processes')).toBeInTheDocument()
})
