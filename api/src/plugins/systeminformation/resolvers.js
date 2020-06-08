import { 
  mem, 
  fsSize, 
  osInfo, 
  cpu,
  time,
  networkInterfaces,
  networkStats,
  dockerAll,
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
  docker: () => dockerAll(),
}

export const Network = {
  networkStats: async ({ iface }) =>{
    const result = await networkStats(iface)
    return result && result.length && result[0] || null
  },
}
