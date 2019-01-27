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
import { getVHosts, checkVHost } from './resolvers/vhosts'

export const Query = {
  memory: () => mem(),
  fs: () => fsSize(),
  system: () => osInfo(),
  cpu: () => cpu(),
  time: () => time(),
  network: () => networkInterfaces(),
  loadAverage: () => loadavg(),
  vhosts: () => getVHosts(),
}

export const Network = {
  networkStats: ({ iface }) => networkStats(iface),
}

export const VHost = {
  statusCode: ({ name, port }) => checkVHost(name, port)
}