import { getHosts, checkPort } from './services'

export const Service = {
  hosts: ({ name, port }) => getHosts(name, port)
}

export const Host = {
  open: ({ name, port }) => checkPort(name, port)
}
