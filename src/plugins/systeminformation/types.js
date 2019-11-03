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

  type SystemInformation {
    memory: Memory
    fs: [FileSystem]
    system: System
    cpu: CPU
    time: Time
    network: [Network]
    loadAverage: [Float]
  }
`
