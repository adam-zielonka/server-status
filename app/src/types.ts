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
  available?: number | null
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
export interface ServiceHealth {
  id: string
  name: string
  unit: string
  scope: string
  state: string
  substate?: string | null
  restarts?: number | null
  result?: string | null
  exit_status?: number | null
  uptime_seconds?: number | null
  last_error?: string | null
  last_error_at?: string | null
  error?: string | null
}
export interface ProcessInfo {
  group_kind?: 'service' | 'browser' | 'process' | null
  ppid?: number | null
  parent_name?: string | null
  service?: string | null
  instance_pid?: number | null
  instance_name?: string | null
  browser_instance_pid?: number | null
  browser_instance_count?: number | null
  process_count?: number | null
  member_pids?: number[] | null
  pid: number
  name: string
  rss_bytes: number
  cpu_percent?: number | null
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
  cpu_quota_cores?: number | null
  effective_cpu_cores?: number | null
  cpu_capacity_cores?: number | null
  memory_limit_bytes?: number | null
  visible_memory_bytes: number
  memory_current_bytes?: number | null
  memory_working_set_bytes?: number | null
  container_uptime_seconds: number
  host_uptime_seconds: number
  limit_scope: string
}
export interface TailscaleInfo {
  state: string
  online: boolean
  hostname?: string | null
  dns_name?: string | null
  addresses?: string[] | null
  expires_at?: string | null
  key_days_remaining?: number | null
  services?: { address: string; paths: string[]; funnel: boolean }[] | null
  error?: string | null
}
export interface DirectoryInfo {
  name: string
  bytes?: number | null
  collected_at?: string | null
  error?: string | null
}
export type JobState = 'success' | 'failure' | 'running' | 'unknown'
export type JobHealth = JobState | 'overdue'
export interface Job {
  name: string
  kind: 'systemd' | 'github'
  category?: string | null
  status: JobState
  last_run_at?: string | null
  completed_at?: string | null
  last_success_at?: string | null
  max_age_seconds?: number | null
  next_run_at?: string | null
  timer_state?: string | null
  last_error?: string | null
  source_url?: string | null
  checked_at?: string | null
  error?: string | null
}
export type HistoryMetric = 'cpu_percent' | 'memory_percent' | 'disk_percent'
export interface CPUCapacity {
  peak_cores: number
  observed_since?: string | null
}
export interface HistoryPoint {
  at: string
  cpu_usage_cores?: number | null
  cpu_capacity_cores?: number | null
  cpu_percent: number | null
  memory_percent: number | null
  disk_percent: number | null
  memory_bytes?: number | null
  disk_used_bytes?: number | null
  directory_bytes?: Record<string, number> | null
}
export interface DatabaseInfo {
  name: string
  status: 'healthy' | 'warning' | 'failure' | 'unknown'
  checked_at?: string | null
  limit_bytes: number
  bytes?: number | null
  available_bytes?: number | null
  used_percent?: number | null
  connections?: number | null
  tls?: boolean | null
  latency_ms?: number | null
  error?: string | null
}
export interface BackupStoreInfo {
  name: string
  status: 'healthy' | 'warning' | 'failure' | 'unknown'
  checked_at?: string | null
  max_age_seconds: number
  bytes?: number | null
  limit_bytes?: number | null
  available_bytes?: number | null
  used_percent?: number | null
  backup_count?: number | null
  latest_backup_bytes?: number | null
  last_success_at?: string | null
  error?: string | null
}
export interface TunnelInfo {
  name: string
  hostnames: string[]
  status: 'healthy' | 'degraded' | 'failure' | 'unknown'
  checked_at?: string | null
  expected_connections: number
  connections?: number | null
  requests?: number | null
  request_errors?: number | null
  locations?: string[] | null
  error?: string | null
}
export interface SoftwareVersion {
  source_url?: string | null
  name: string
  source: string
  channel?: string | null
  installed_version?: string | null
  available_version?: string | null
  status: 'current' | 'update_available' | 'unknown'
  checked_at?: string | null
  error?: string | null
}
export interface SoftwareInfo {
  checked_at?: string | null
  interval_seconds: number
  tools: SoftwareVersion[]
  apt?: {
    status: 'current' | 'update_available' | 'unknown'
    checked_at?: string | null
    security_index_at?: string | null
    error?: string | null
    updates: {
      name: string
      installed_version: string
      available_version: string
      source_url?: string | null
    }[]
  } | null
}
export interface TelemetrySnapshot {
  enabled: true
  schema_version: 1
  collected_at: string
  sample_at?: string | null
  sample_interval_seconds: number
  services: ServiceHealth[]
  processes: Processes
  container: ContainerInfo
  cpu_capacity?: CPUCapacity | null
  tailscale?: TailscaleInfo | null
  databases?: DatabaseInfo[] | null
  backup_stores?: BackupStoreInfo[] | null
  software?: SoftwareInfo | null
  tunnels?: TunnelInfo[] | null
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
  telemetry: Telemetry
}
export type Endpoint = keyof EndpointMap
export type Page =
  'overview' | 'services' | 'processes' | 'storage' | 'network' | 'system' | 'tasks' | 'software'
