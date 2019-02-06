import { gql } from 'apollo-server'

export default gql`
  type Memory {
    total: Float
    free: Float
    used: Float
    active: Float
    available: Float
    buffcache: Float
    swaptotal: Float
    swapused: Float
    swapfree: Float
  }

  type FileSystem {
    fs: String
    type: String
    size: Float
    used: Float
    use: Float
    mount: String
  }

  type System {
    platform: String
    distro: String
    release: String
    codename: String
    kernel: String
    arch: String
    hostname: String
  }

  type CPU {
    manufacturer: String
    brand: String
    speed: String
    cores: Float
  }

  type Time {
    current: Float
    uptime: Float
    timezone: String
    timezoneName: String
  }

  type NetworkStats {
    iface: String
    operstate: String
    rx: Float
    tx: Float
    rx_sec: Float
    tx_sec: Float
    ms: Float
  }

  type Network {
    iface: String
    ip4: String
    ip6: String
    mac: String
    internal: Boolean
    networkStats: NetworkStats
  }

  type VHost {
    port: String
    name: String
    statusCode: String
  }

  type PM2_ENV {
    exec_mode: String
    status: String
    watch: Boolean
    pm_uptime: Float
    restart_time: Float
  }

  type PM2_monit {
    memory: Float
    cpu: Float
  }

  type PM2 {
    name: String
    pm2_env: PM2_ENV
    monit: PM2_monit
    pm_id: Float
  }

  type Host {
    name: String
    port: Float
    open: Boolean
  }

  type Service {
    name: String
    port: Float
    link: String
    hosts: [Host]
  }

  type SysInfo {
    memory: Memory
    fs: [FileSystem]
    system: System
    cpu: CPU
    time: Time
    network: [Network]
    loadAverage: [Float]
    vhosts: [VHost]
    pm2: [PM2]
    services: [Service]
  }

  type Query {
    sysinfo: SysInfo
  }

  type AuthPayload {
    token: String
    user: User
  }

  type User {
    id: ID
    name: String
  }

  type Mutation {
    login(name: String!, pass: String!): AuthPayload
  }
`