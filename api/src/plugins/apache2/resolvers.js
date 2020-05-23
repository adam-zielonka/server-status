import { getVHosts, checkVHost } from './vhosts'

export const Apache2 = {
  vhosts: () => getVHosts(),
}

export const VHost = {
  statusCode: ({ name, port }) => checkVHost(name, port)
}
