import { getVHosts, checkVHost, checkVHost2 } from './vhosts'

export const Caddy = {
  vhosts: () => getVHosts(),
}

export const VHost = {
  statusCode: ({ name, port }) => checkVHost(name, port),
  externalStatusCode: ({ name, port }) => checkVHost2(name, port)
}
