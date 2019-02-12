import { getConfig } from '../tools'
import request from 'request-promise'
import { exec } from '../tools'

export async function getVHosts() {
  const { stdout } = await exec('apache2ctl -t -D DUMP_VHOSTS')

  const vhosts = []
  const rows = stdout.split('\n').filter(row => row.match(/^\s.*port/))
  for (let row of rows) {
    let vhost = {}
    let property = null
    for(let value of row.split(' ')) {
      switch (property) {
        case "port":
          vhost.port = value
          break
        case "namevhost":
          vhost.name = value
          break
      }
      property = value
    }
    vhosts.push(vhost)
  }
  return vhosts
}

function auth() {
  return getConfig().VHOST && getConfig().VHOST.user ? {
    user: getConfig().VHOST.user,
    pass: getConfig().VHOST.pass,
    sendImmediately: false
  } : {}
}

export async function checkVHost(name, port) {
  const options = {
    uri: `http://${name}:${port}`,
    auth: auth(),
    resolveWithFullResponse: true
  }
  try {
    const response = await Promise.resolve(request(options))
    return response.statusCode
  } catch (error) {
    return error.statusCode
  }

}