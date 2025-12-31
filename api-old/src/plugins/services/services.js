import isPortReachable from 'is-port-reachable'
import { getConfig } from './config'

export async function getServices() {
  return getConfig().services
}

export async function getHosts(serviceName, port) {
  const result = []
  const service = getConfig().services.find(s => s.name === serviceName)
  if(service.hosts) for(let host of service.hosts) {
    result.push({ name: host, port })
  }
  if(getConfig().hosts) for(let host of getConfig().hosts) {
    result.push({ name: host, port })
  }
  return result
}

export async function checkPort(host, port) {
  return await isPortReachable(port, { host })
}
