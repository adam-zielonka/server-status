import "@babel/polyfill"

import ServerStatus from './index'

const config = {
  WEB: {
      localhost: false,
      port: 4000,
  },
}

const server = ServerStatus(config)

server.listen()
