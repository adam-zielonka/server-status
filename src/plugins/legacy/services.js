import { getConfig } from '../../tools'
import isPortReachable from 'is-port-reachable'

export async function getServices() {
  return getConfig().SERVICES
}

export async function getHosts(serviceName, port) {
  const result = []
  const service = getConfig().SERVICES.find(s => s.name === serviceName)
  if(service.hosts) for(let host of service.hosts) {
    result.push({ name: host, port })
  }
  if(getConfig().HOSTS) for(let host of getConfig().HOSTS) {
    result.push({ name: host, port })
  }
  return result
}

export async function checkPort(host, port) {
  return await isPortReachable(port, { host })
}
