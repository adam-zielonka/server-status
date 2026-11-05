import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BackupStores } from './backup-stores'
import { monitoringIssues } from '@/lib/monitoring'
import { demoTelemetry } from '@/lib/demo'
import type { BackupStoreInfo } from '@/types'

it('shows reported backup capacity and size, and expires independently of a fresh snapshot', () => {
  const now = Date.now()
  const store: BackupStoreInfo = {
    name: 'Example backup',
    status: 'healthy',
    checked_at: new Date(now).toISOString(),
    max_age_seconds: 1800,
    bytes: 1000,
    limit_bytes: 200000,
    available_bytes: 199000,
    used_percent: 0.5,
    backup_count: 7,
    last_success_at: new Date(now).toISOString(),
    latest_backup_bytes: 500,
  }
  const view = render(<BackupStores stores={[store]} now={now} />)
  expect(screen.getByText('healthy')).toBeInTheDocument()
  expect(screen.getByText('7')).toBeInTheDocument()
  expect(screen.getByText('Latest backup')).toBeInTheDocument()
  expect(screen.getByText('500 B · reported size')).toBeInTheDocument()
  expect(screen.queryByText(/verified/i)).not.toBeInTheDocument()
  view.rerender(<BackupStores stores={[store]} now={now + 3600000} />)
  expect(screen.getByText('Stale')).toBeInTheDocument()
  expect(screen.queryByText('healthy')).not.toBeInTheDocument()
  const snapshot = demoTelemetry(now + 3600000)
  snapshot.backup_stores = [store]
  expect(monitoringIssues(snapshot, now + 3600000)).toContainEqual(
    expect.objectContaining({
      id: 'backup-store:Example backup',
      page: 'storage',
      severity: 'warning',
    }),
  )
})

it('keeps failed measurements unavailable and flags capacity failures', () => {
  const now = Date.now()
  const store: BackupStoreInfo = {
    name: 'Example backup',
    status: 'unknown',
    checked_at: new Date(now).toISOString(),
    max_age_seconds: 1800,
    error: 'Storage check failed',
  }
  const view = render(<BackupStores stores={[store]} now={now} />)
  expect(screen.getByText('unknown')).toBeInTheDocument()
  expect(screen.queryByText('0 B')).not.toBeInTheDocument()
  view.rerender(<BackupStores stores={undefined} now={now} />)
  expect(screen.queryByText('Backup storage')).not.toBeInTheDocument()
  const snapshot = demoTelemetry(now)
  snapshot.backup_stores = [{ ...store, error: undefined, status: 'failure', used_percent: 98 }]
  expect(monitoringIssues(snapshot, now)).toContainEqual(
    expect.objectContaining({ id: 'backup-store:Example backup', severity: 'critical' }),
  )
})

it('does not present a null latest backup size as a measured copy', () => {
  const store = { ...demoTelemetry().backup_stores![0], latest_backup_bytes: null }
  render(<BackupStores stores={[store]} now={Date.now()} />)
  expect(screen.queryByText(/reported size/)).not.toBeInTheDocument()
  expect(screen.queryByText(/verified/i)).not.toBeInTheDocument()
})
