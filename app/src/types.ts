export interface Session {
  user: string
  token: string
}
export interface SystemInfo {
  system: { distro: string; release: string; kernel: string; arch: string; hostname: string }
  cpu: { manufacturer: string; brand: string; speed: number; cores: number }
  time: { uptime: number }
}
export interface MemoryInfo {
  used: number
  cached: number
  free: number
  total: number
  swapfree: number
  swaptotal: number
  swapused: number
}
export interface FileSystem {
  fs: string
  type: string
  size: number
  used: number
  use: number
  available?: number
  mount: string
}
export interface NetworkInterface {
  iface: string
  addresses: string[]
  rx_bytes: number
  tx_bytes: number
}
export interface PortService {
  name: string
  port: string
  hosts: { name: string; port: string; open: boolean }[]
}
export interface VirtualHost {
  port: string
  name: string
  statusCode: string
  externalStatusCode?: string
}
export interface ServiceHealth {
  id: string
  name: string
  unit: string
  scope: string
  state: string
  substate?: string
  restarts?: number
  result?: string
  exit_status?: number
  uptime_seconds?: number | null
  last_error?: string | null
  last_error_at?: string | null
  error?: string
}
export interface ProcessInfo {
  group_kind?: 'service' | 'browser' | 'process'
  ppid?: number | null
  parent_name?: string | null
  service?: string | null
  instance_pid?: number
  instance_name?: string
  browser_instance_pid?: number | null
  browser_instance_count?: number
  process_count?: number
  member_pids?: number[]
  pid: number
  name: string
  rss_bytes: number
  cpu_percent: number | null
}
export interface Processes {
  groups_cpu: ProcessInfo[]
  groups_memory: ProcessInfo[]
  top_cpu: ProcessInfo[]
  top_memory: ProcessInfo[]
  sample_seconds: number
  cpu_basis: string
}
export interface ContainerInfo {
  virtualization: string
  cpu_count: number
  cpuset: string
  cpu_quota_cores: number | null
  effective_cpu_cores?: number
  memory_limit_bytes: number | null
  visible_memory_bytes: number
  memory_current_bytes: number | null
  memory_working_set_bytes: number | null
  container_uptime_seconds: number
  host_uptime_seconds: number
  limit_scope: string
}
export interface TailscaleInfo {
  state: string
  online: boolean
  hostname?: string
  dns_name?: string
  addresses?: string[]
  expires_at?: string | null
  key_days_remaining?: number | null
  services?: { address: string; paths: string[]; funnel: boolean }[]
  error?: string
}
export interface DirectoryInfo {
  name: string
  bytes: number | null
  collected_at: string | null
  error?: string
}
export type JobState = 'success' | 'failure' | 'running' | 'unknown'
export type JobHealth = JobState | 'overdue'
export interface Job {
  name: string
  kind: 'systemd' | 'github'
  category?: string
  status: JobState
  last_run_at?: string | null
  completed_at?: string | null
  last_success_at?: string | null
  max_age_seconds?: number
  next_run_at?: string | null
  timer_state?: string
  last_error?: string
  source_url?: string
  checked_at?: string
  error?: string
}
export type HistoryMetric = 'cpu_percent' | 'memory_percent' | 'disk_percent'
export interface HistoryPoint {
  at: string
  cpu_percent: number | null
  memory_percent: number | null
  disk_percent: number | null
  memory_bytes?: number | null
  disk_used_bytes?: number
  directory_bytes?: Record<string, number>
}
export interface DatabaseInfo {
  name: string
  status: 'healthy' | 'warning' | 'failure' | 'unknown'
  checked_at: string
  limit_bytes: number
  bytes?: number
  available_bytes?: number
  used_percent?: number
  connections?: number
  tls?: boolean
  latency_ms?: number
  error?: string
}
export interface BackupStoreInfo {
  name: string
  status: 'healthy' | 'warning' | 'failure' | 'unknown'
  checked_at: string | null
  max_age_seconds: number
  bytes?: number
  limit_bytes?: number
  available_bytes?: number
  used_percent?: number
  backup_count?: number
  latest_backup_bytes?: number
  last_success_at?: string
  error?: string
}
export interface TunnelInfo {
  name: string
  hostnames: string[]
  status: 'healthy' | 'degraded' | 'failure' | 'unknown'
  checked_at: string
  expected_connections: number
  connections?: number
  requests?: number
  request_errors?: number
  locations?: string[]
  error?: string
}
export interface SoftwareVersion {
  name: string
  source: string
  channel?: string
  installed_version?: string | null
  available_version?: string | null
  status: 'current' | 'update_available' | 'unknown'
  checked_at: string
  error?: string
}
export interface SoftwareInfo {
  checked_at: string
  interval_seconds: number
  tools: SoftwareVersion[]
  apt: {
    status: 'current' | 'update_available' | 'unknown'
    checked_at: string
    security_index_at: string | null
    error?: string
    updates: { name: string; installed_version: string; available_version: string }[]
  } | null
}
export interface TelemetrySnapshot {
  enabled: true
  schema_version: 1
  collected_at: string
  sample_at?: string
  sample_interval_seconds: number
  services: ServiceHealth[]
  processes: Processes
  container: ContainerInfo
  tailscale: TailscaleInfo | null
  databases?: DatabaseInfo[]
  backup_stores?: BackupStoreInfo[]
  software?: SoftwareInfo | null
  tunnels?: TunnelInfo[]
  directories: DirectoryInfo[]
  jobs: Job[]
  history: HistoryPoint[]
}
export type Telemetry = TelemetrySnapshot | { enabled: false }
export interface EndpointMap {
  ok: string
  system: SystemInfo
  memory: MemoryInfo
  'load-average': [number, number, number]
  'file-system': FileSystem[]
  net: NetworkInterface[]
  services: PortService[]
  vhosts: VirtualHost[]
  telemetry: Telemetry
}
export type Endpoint = keyof EndpointMap
export type Page =
  'overview' | 'services' | 'processes' | 'storage' | 'network' | 'system' | 'tasks' | 'software'
