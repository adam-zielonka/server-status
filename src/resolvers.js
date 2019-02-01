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
import { exec } from './tools'

export const Query = {
  memory: () => mem(),
  fs: () => fsSize(),
  system: () => osInfo(),
  cpu: () => cpu(),
  time: () => time(),
  network: () => networkInterfaces(),
  loadAverage: () => loadavg(),
  vhosts: () => getVHosts(),
  pm2: async () => {
    const { stdout } = await exec('pm2 jlist')
    return JSON.parse(stdout)
  }
}

export const Network = {
  networkStats: ({ iface }) => networkStats(iface),
}

export const VHost = {
  statusCode: ({ name, port }) => checkVHost(name, port)
}