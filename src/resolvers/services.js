import config from '../config'
import isPortReachable from 'is-port-reachable'

export async function getServices() {
    return config.services
}

export async function getHosts(serviceName, port) {
    const result = []
    const service = config.services.find(s => s.name === serviceName)
    if(service.hosts) for(let host of service.hosts) {
        result.push({ name: host, port })
    }
    if(config.hosts) for(let host of config.hosts) {
        result.push({ name: host, port })
    }
    return result
}

export async function checkPort(host, port) {
    return await isPortReachable(port, { host })
}