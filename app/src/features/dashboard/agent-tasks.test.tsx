import { expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentTasks } from './agent-tasks'
import { demoTelemetry } from '@/lib/demo'
import { validAgentQueue, validEndpoint } from '@/lib/validation'
import { safeQueueUrl } from '@/lib/agent-queue'

it('shows disjoint groups and status details, then expires despite a fresh snapshot', async () => {
  const now = Date.now()
  const queue = demoTelemetry(now).agent_queue!
  let expanded = false
  const view = render(
    <AgentTasks
      queue={queue}
      now={now}
      onExpand={() => {
        expanded = true
      }}
    />,
  )
  const summary = screen.getByRole('region', { name: 'Agent task summary' })
  expect(within(summary).getByLabelText('Open agent tasks')).toHaveTextContent('12')
  for (const label of ['Queued', 'Active', 'Waiting for you', 'Blocked'])
    expect(within(summary).getByText(label)).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Details' }))
  expect(expanded).toBe(true)
  view.rerender(<AgentTasks queue={queue} now={now + 900_000} expanded />)
  expect(screen.getByText('Stale')).toBeVisible()
  expect(screen.getByLabelText('Agent task statuses')).toHaveTextContent('Review')
  expect(screen.getByText(/A parent and its child are two issues/)).toBeVisible()
})

it('keeps error counts, distinguishes a complete zero from missing data and omits disabled integration', () => {
  const now = Date.now(),
    queue = demoTelemetry(now).agent_queue!
  const view = render(
    <AgentTasks queue={{ ...queue, status: 'error', error: 'Synthetic source error' }} now={now} />,
  )
  expect(screen.getByText('Source error')).toBeVisible()
  expect(screen.getByLabelText('Open agent tasks')).toHaveTextContent('12')
  view.rerender(
    <AgentTasks
      queue={{
        ...queue,
        status: 'unavailable',
        counts: null,
        last_success_at: null,
        error: 'Synthetic initial error',
      }}
      now={now}
    />,
  )
  expect(screen.getByText('No data')).toBeVisible()
  expect(screen.getByLabelText('Open agent tasks')).toHaveTextContent('—')
  expect(screen.queryByText('0')).not.toBeInTheDocument()
  const zero = structuredClone(queue)
  zero.counts = {
    open: 0,
    queued: 0,
    active: 0,
    waiting: 0,
    blocked: 0,
    statuses: { new: 0, ready: 0, analysis: 0, in_progress: 0, review: 0, waiting: 0, blocked: 0 },
  }
  view.rerender(<AgentTasks queue={zero} now={now} />)
  expect(screen.getByLabelText('Open agent tasks')).toHaveTextContent('0')
  view.rerender(<AgentTasks now={now} />)
  expect(screen.queryByText('Agent tasks')).not.toBeInTheDocument()
})

it('validates optional backwards compatibility, arithmetic, dates, private fields and safe board links', () => {
  const snapshot = demoTelemetry(),
    queue = snapshot.agent_queue!
  expect(validEndpoint('telemetry', snapshot)).toBe(true)
  delete snapshot.agent_queue
  expect(validEndpoint('telemetry', snapshot)).toBe(true)
  expect(
    validAgentQueue({ ...queue, status: 'unavailable', counts: null, last_success_at: null }),
  ).toBe(true)
  for (const bad of [
    { ...queue, counts: null },
    { ...queue, last_success_at: 'invalid' },
    { ...queue, last_attempt_at: null },
    { ...queue, title: 'private' },
    { ...queue, counts: { ...queue.counts, open: 100 } },
    { ...queue, counts: { ...queue.counts, queued: -1 } },
    { ...queue, counts: { ...queue.counts, open: 1.5 } },
    { ...queue, counts: { ...queue.counts, statuses: { ...queue.counts!.statuses, new: 4 } } },
    { ...queue, source_url: 'https://github.com/users/example/projects/1?token=private' },
  ])
    expect(validAgentQueue(bad)).toBe(false)
  for (const url of [
    'javascript:alert(1)',
    'http://github.com/users/example/projects/1',
    'https://token@github.com/users/example/projects/1',
    'https://evil.test/users/example/projects/1',
    'https://github.com/example/repo',
    'https://github.com/users/example/projects/1#private',
  ])
    expect(safeQueueUrl(url)).toBeUndefined()
  const serialized = JSON.stringify(queue)
  for (const text of ['actor', 'token', '/root/', 'private-repository', 'private-host'])
    expect(serialized).not.toContain(text)
})
