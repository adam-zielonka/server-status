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
import { getVHosts, checkVHost } from './vhosts'
import { getServices, getHosts, checkPort } from './services'
import { exec } from '../tools'

export const SysInfo = {
  memory: () => mem(),
  fs: () => fsSize(),
  system: () => osInfo(),
  cpu: () => cpu(),
  time: () => time(),
  network: () => networkInterfaces(),
  loadAverage: () => loadavg(),
  vhosts: () => getVHosts(),
  services: () => getServices(),
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

export const Service = {
  hosts: ({ name, port }) => getHosts(name, port)
}

export const Host = {
  open: ({ name, port }) => checkPort(name, port)
}