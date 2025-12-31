import request from 'request-promise'
import { getConfig } from './config'
import { execSync } from 'child_process'
import fs from 'fs'

export async function getVHosts() {
  const caddy = JSON.parse(await execSync(`curl -s localhost:${getConfig().port}/config/`, { encoding: 'utf8' }))

  const servers = caddy.apps.http.servers

  const vhosts = []

  for (const key in servers) {
    if (Object.prototype.hasOwnProperty.call(servers, key)) {
      const element = servers[key]
      const port = element.listen[0].replace(':','')
      for (const route of element.routes) {
        vhosts.push({ port, name: route.match[0].host[0] })
      }
    }
  }

  return vhosts
}

function auth() {
  const { user, pass } = getConfig()

  return user ? { user, pass, sendImmediately: false } : null
}

function rootCA() {
  const { rootCAPath } = getConfig()

  return rootCAPath ? {
    ca: fs.readFileSync(rootCAPath)
  } : null
}

export async function checkVHost(name) {
  const options = {
    uri: `http://${name}`,
    auth: auth(),
    resolveWithFullResponse: true,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
    agentOptions: rootCA()
  }
  try {
    const response = await Promise.resolve(request(options))
    return response.statusCode
  } catch (error) {
    return error.statusCode
  }

}

export async function checkVHost2(name) {
  const { external } = getConfig()

  if(!external) return 'Need setup'

  const options = {
    method: 'POST',
    uri: external,
    body: `http://${name}`,
    resolveWithFullResponse: true,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    }
  }
  try {
    const response = await Promise.resolve(request(options))
    return response.body
  } catch (error) {
    console.log(error)
    return error.statusCode
  }

}
