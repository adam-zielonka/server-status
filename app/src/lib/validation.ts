import type { Endpoint } from '@/types'

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const string = (value: unknown): value is string => typeof value === 'string'
const strings = (value: unknown): boolean => Array.isArray(value) && value.every(string)
const array = (value: unknown, valid: (row: Record<string, unknown>) => boolean): boolean =>
  Array.isArray(value) &&
  value.every(
    (row) =>
      record(row) &&
      fields(row, ['error', 'last_error'], (field) => optional(field, string)) &&
      valid(row),
  )
const fields = (
  value: Record<string, unknown>,
  names: string[],
  valid: (field: unknown) => boolean,
): boolean => names.every((name) => valid(value[name]))
const optional = (value: unknown, valid: (field: unknown) => boolean): boolean =>
  value == null || valid(value)
const numbers = (value: Record<string, unknown>, names: string[]): boolean =>
  fields(value, names, number)
const text = (value: Record<string, unknown>, names: string[]): boolean =>
  fields(value, names, string)

function validTelemetry(value: Record<string, unknown>): boolean {
  if (value.enabled === false) return true
  if (
    value.enabled !== true ||
    value.schema_version !== 1 ||
    !string(value.collected_at) ||
    !Number.isFinite(Date.parse(value.collected_at)) ||
    !number(value.sample_interval_seconds) ||
    value.sample_interval_seconds <= 0
  )
    return false
  const c = value.container
  const p = value.processes
  if (
    !record(c) ||
    !numbers(c, [
      'cpu_count',
      'visible_memory_bytes',
      'container_uptime_seconds',
      'host_uptime_seconds',
    ]) ||
    !text(c, ['virtualization', 'cpuset', 'limit_scope']) ||
    !fields(
      c,
      [
        'cpu_quota_cores',
        'effective_cpu_cores',
        'cpu_capacity_cores',
        'memory_limit_bytes',
        'memory_current_bytes',
        'memory_working_set_bytes',
      ],
      (field) => optional(field, number),
    )
  )
    return false
  if (
    !record(p) ||
    !number(p.sample_seconds) ||
    !string(p.cpu_basis) ||
    !fields(p, ['top_cpu', 'top_memory', 'groups_cpu', 'groups_memory'], (rows) =>
      array(
        rows,
        (row) =>
          text(row, ['name']) &&
          numbers(row, ['pid', 'rss_bytes']) &&
          optional(row.cpu_percent, number) &&
          fields(
            row,
            [
              'ppid',
              'instance_pid',
              'browser_instance_pid',
              'browser_instance_count',
              'process_count',
            ],
            (field) => optional(field, number),
          ) &&
          fields(row, ['service', 'parent_name', 'instance_name', 'group_kind'], (field) =>
            optional(field, string),
          ) &&
          optional(row.member_pids, (members) => Array.isArray(members) && members.every(number)),
      ),
    )
  )
    return false
  return (
    optional(
      value.cpu_capacity,
      (peak) =>
        record(peak) &&
        number(peak.peak_cores) &&
        peak.peak_cores >= 0 &&
        (peak.observed_since === null ||
          (string(peak.observed_since) && Number.isFinite(Date.parse(peak.observed_since)))),
    ) &&
    array(
      value.services,
      (row) =>
        text(row, ['id', 'name', 'unit', 'scope', 'state']) &&
        fields(row, ['uptime_seconds', 'restarts', 'exit_status'], (field) =>
          optional(field, number),
        ),
    ) &&
    array(value.directories, (row) => string(row.name) && optional(row.bytes, number)) &&
    array(
      value.jobs,
      (row) =>
        text(row, ['name', 'kind', 'status']) &&
        ['systemd', 'github'].includes(row.kind as string) &&
        ['success', 'failure', 'running', 'unknown'].includes(row.status as string) &&
        fields(row, ['category', 'timer_state', 'source_url'], (field) =>
          optional(field, string),
        ) &&
        optional(row.max_age_seconds, number),
    ) &&
    array(
      value.history,
      (row) =>
        string(row.at) &&
        Number.isFinite(Date.parse(row.at)) &&
        fields(
          row,
          ['cpu_percent', 'memory_percent', 'disk_percent'],
          (field) => field === null || number(field),
        ) &&
        optional(row.cpu_usage_cores, (value) => number(value) && value >= 0) &&
        optional(row.cpu_capacity_cores, (value) => number(value) && value > 0) &&
        optional(
          row.directory_bytes,
          (directories) => record(directories) && Object.values(directories).every(number),
        ),
    ) &&
    optional(
      value.tailscale,
      (ts) =>
        record(ts) &&
        string(ts.state) &&
        typeof ts.online === 'boolean' &&
        fields(ts, ['error', 'dns_name', 'hostname', 'expires_at'], (field) =>
          optional(field, string),
        ) &&
        optional(ts.key_days_remaining, number) &&
        optional(ts.addresses, strings) &&
        optional(ts.services, (rows) =>
          array(
            rows,
            (row) => string(row.address) && strings(row.paths) && typeof row.funnel === 'boolean',
          ),
        ),
    ) &&
    optional(
      value.software,
      (sw) =>
        record(sw) &&
        text(sw, ['checked_at']) &&
        number(sw.interval_seconds) &&
        sw.interval_seconds >= 3600 &&
        array(
          sw.tools,
          (row) =>
            text(row, ['name', 'source', 'status', 'checked_at']) &&
            ['current', 'update_available', 'unknown'].includes(row.status as string) &&
            fields(row, ['installed_version', 'available_version', 'channel'], (f) =>
              optional(f, string),
            ),
        ) &&
        optional(
          sw.apt,
          (apt) =>
            record(apt) &&
            text(apt, ['status', 'checked_at']) &&
            ['current', 'update_available', 'unknown'].includes(apt.status as string) &&
            optional(apt.error, string) &&
            optional(apt.security_index_at, string) &&
            array(apt.updates, (row) =>
              text(row, ['name', 'installed_version', 'available_version']),
            ),
        ),
    ) &&
    optional(value.backup_stores, (rows) =>
      array(
        rows,
        (row) =>
          text(row, ['name', 'status']) &&
          ['healthy', 'warning', 'failure', 'unknown'].includes(row.status as string) &&
          (row.checked_at === null || string(row.checked_at)) &&
          number(row.max_age_seconds) &&
          row.max_age_seconds > 0 &&
          optional(row.last_success_at, string) &&
          fields(
            row,
            [
              'bytes',
              'limit_bytes',
              'available_bytes',
              'used_percent',
              'backup_count',
              'latest_backup_bytes',
            ],
            (field) => optional(field, number),
          ),
      ),
    ) &&
    optional(value.databases, (rows) =>
      array(
        rows,
        (row) =>
          text(row, ['name', 'status', 'checked_at']) &&
          number(row.limit_bytes) &&
          optional(row.tls, (field) => typeof field === 'boolean') &&
          fields(
            row,
            ['bytes', 'available_bytes', 'used_percent', 'connections', 'latency_ms'],
            (field) => optional(field, number),
          ),
      ),
    ) &&
    optional(value.tunnels, (rows) =>
      array(
        rows,
        (row) =>
          text(row, ['name', 'status', 'checked_at']) &&
          strings(row.hostnames) &&
          number(row.expected_connections) &&
          fields(row, ['connections', 'requests', 'request_errors'], (field) =>
            optional(field, number),
          ) &&
          optional(row.locations, strings),
      ),
    )
  )
}

// Validate at the network boundary so malformed snapshots become recoverable
// source errors instead of exceptions that take down the entire dashboard.
export function validEndpoint(endpoint: Endpoint, value: unknown): boolean {
  switch (endpoint) {
    case 'ok':
      return value === 'ok'
    case 'telemetry':
      return record(value) && validTelemetry(value)
    case 'system':
      return (
        record(value) &&
        record(value.system) &&
        record(value.cpu) &&
        record(value.time) &&
        text(value.system, ['distro', 'release', 'kernel', 'arch', 'hostname']) &&
        text(value.cpu, ['manufacturer', 'brand']) &&
        numbers(value.cpu, ['speed', 'cores']) &&
        number(value.time.uptime)
      )
    case 'memory':
      return (
        record(value) &&
        numbers(value, ['used', 'cached', 'free', 'total', 'swapfree', 'swaptotal', 'swapused'])
      )
    case 'load-average':
      return Array.isArray(value) && value.length === 3 && value.every(number)
    case 'file-system':
      return array(
        value,
        (row) =>
          text(row, ['fs', 'type', 'mount']) &&
          numbers(row, ['size', 'used', 'use']) &&
          optional(row.available, number),
      )
    case 'net':
      return array(
        value,
        (row) =>
          string(row.iface) && strings(row.addresses) && numbers(row, ['rx_bytes', 'tx_bytes']),
      )
    case 'services':
      return array(
        value,
        (row) =>
          text(row, ['name', 'port']) &&
          array(
            row.hosts,
            (host) => text(host, ['name', 'port']) && typeof host.open === 'boolean',
          ),
      )
    case 'vhosts':
      return array(
        value,
        (row) =>
          text(row, ['name', 'port', 'statusCode']) && optional(row.externalStatusCode, string),
      )
  }
}
