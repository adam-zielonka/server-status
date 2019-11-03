import { 
  mem, 
  fsSize, 
  osInfo, 
  cpu,
  time,
  networkInterfaces,
  networkStats,
} from 'systeminformation'
import { loadavg } from 'os'

export const SystemInformation = {
  memory: () => mem(),
  fs: () => fsSize(),
  system: () => osInfo(),
  cpu: () => cpu(),
  time: () => time(),
  network: () => networkInterfaces(),
  loadAverage: () => loadavg(),
}

export const Network = {
  networkStats: ({ iface }) => networkStats(iface),
}
