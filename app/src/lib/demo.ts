import type { Endpoint, EndpointMap, TelemetrySnapshot } from '@/types'

// Every value in this module is synthetic. Never import production snapshots.
export function demoTelemetry(now = Date.now()): TelemetrySnapshot {
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString()
  const history = Array.from({ length: 1440 }, (_, i) => {
    const wave = (Math.sin(i / 35) + 1) / 2
    return {
      at: at((1439 - i) * 60),
      cpu_percent: 8 + wave * 35,
      memory_percent: 32 + wave * 12,
      disk_percent: 24 + i / 1440,
      memory_bytes: ((32 + wave * 12) / 100) * 8 * 1024 ** 3,
      disk_used_bytes: ((24 + i / 1440) / 100) * 80 * 1024 ** 3,
      directory_bytes: {
        'Application data': 2 * 1024 ** 3 + i * 32000,
        'System logs': 120 * 1024 ** 2 + i * 1200,
      },
    }
  })
  const processes = [
    { pid: 120, name: 'example-worker', cpu_percent: 18.4, rss_bytes: 900 * 1024 ** 2 },
    { pid: 121, name: 'example-web', cpu_percent: 2.1, rss_bytes: 150 * 1024 ** 2 },
    { pid: 122, name: 'example-db', cpu_percent: 1.2, rss_bytes: 210 * 1024 ** 2 },
    { pid: 123, name: 'example-cache', cpu_percent: 0.3, rss_bytes: 85 * 1024 ** 2 },
  ]
  return {
    schema_version: 1,
    enabled: true,
    collected_at: at(0),
    sample_interval_seconds: 60,
    history,
    services: [
      'SSH',
      'Application',
      'Tailscale',
      'Background worker',
      'Database',
      'Server Status',
    ].map((name, i) => ({
      id: `system:example-${i}.service`,
      name,
      unit: `example-${i}.service`,
      scope: 'system',
      state: 'active',
      substate: 'running',
      uptime_seconds: 10800 + i * 70,
      restarts: 0,
    })),
    processes: {
      cpu_basis: '100% equals one logical CPU',
      sample_seconds: 1,
      top_cpu: processes,
      top_memory: [...processes].sort((a, b) => b.rss_bytes - a.rss_bytes),
    },
    container: {
      virtualization: 'lxc',
      cpu_count: 2,
      cpuset: '0-1',
      cpu_quota_cores: 2,
      memory_limit_bytes: 8 * 1024 ** 3,
      visible_memory_bytes: 8 * 1024 ** 3,
      memory_current_bytes: 5 * 1024 ** 3,
      memory_working_set_bytes: 3 * 1024 ** 3,
      container_uptime_seconds: 10800,
      host_uptime_seconds: 300000,
      limit_scope: 'Visible cgroup subtree; limits imposed by ancestors may be hidden',
    },
    tailscale: {
      state: 'Running',
      online: true,
      hostname: 'example-node',
      dns_name: 'example-node.example.ts.net',
      addresses: ['100.64.0.10'],
      expires_at: at(-90 * 86400),
      key_days_remaining: 90,
      services: [
        { address: 'example-node.example.ts.net:8443', paths: ['/', '/api'], funnel: false },
      ],
    },
    directories: [
      {
        name: 'Application data',
        bytes: history.at(-1)!.directory_bytes['Application data'],
        collected_at: at(120),
      },
      {
        name: 'System logs',
        bytes: history.at(-1)!.directory_bytes['System logs'],
        collected_at: at(120),
      },
    ],
    jobs: [
      {
        name: 'Scheduled maintenance',
        kind: 'systemd',
        category: 'maintenance',
        status: 'success',
        last_run_at: at(1810),
        last_success_at: at(1800),
        next_run_at: at(-1800),
        timer_state: 'active',
        max_age_seconds: 7200,
      },
      {
        name: 'Application backup',
        kind: 'github',
        category: 'backup',
        status: 'success',
        last_run_at: at(10860),
        last_success_at: at(10800),
        max_age_seconds: 172800,
        checked_at: at(60),
      },
    ],
  }
}

export function demoEndpoint<K extends Endpoint>(endpoint: K): EndpointMap[K] {
  const data: EndpointMap = {
    ok: 'ok',
    system: {
      system: {
        distro: 'Ubuntu',
        release: '24.04',
        kernel: '6.8.0-generic',
        arch: 'x86_64',
        hostname: 'example-node',
      },
      cpu: { manufacturer: 'Example', brand: 'Virtual CPU', speed: 2.4, cores: 2 },
      time: { uptime: 10800 },
    },
    memory: {
      used: 3 * 1024 ** 3,
      cached: 2 * 1024 ** 3,
      free: 3 * 1024 ** 3,
      total: 8 * 1024 ** 3,
      swapused: 0,
      swapfree: 0,
      swaptotal: 0,
    },
    'load-average': [0.31, 0.24, 0.18],
    'file-system': [
      {
        fs: '/dev/example/root',
        mount: '/',
        type: 'ext4',
        size: 80 * 1024 ** 3,
        used: 20 * 1024 ** 3,
        use: 25,
      },
    ],
    net: [
      {
        iface: 'eth0',
        addresses: ['192.0.2.10/24'],
        rx_bytes: 8.2 * 1024 ** 3,
        tx_bytes: 1.4 * 1024 ** 3,
      },
      {
        iface: 'tailscale0',
        addresses: ['100.64.0.10/32'],
        rx_bytes: 120 * 1024 ** 2,
        tx_bytes: 25 * 1024 ** 2,
      },
    ],
    services: [
      { name: 'SSH', port: '22', hosts: [{ name: '127.0.0.1', port: '22', open: true }] },
      {
        name: 'Application',
        port: '4000',
        hosts: [
          { name: '127.0.0.1', port: '4000', open: true },
          { name: '100.64.0.10', port: '4000', open: false },
        ],
      },
    ],
    vhosts: [{ port: '443', name: 'example.com', statusCode: '200', externalStatusCode: '200' }],
    telemetry: demoTelemetry(),
  }
  return data[endpoint]
}
