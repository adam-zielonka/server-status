import types from './types'
import { exec } from './utils'

module.exports = {
  types,
  query: {
    name: 'pm2',
    type: '[PM2]',
    resolver: async () => {
      const { stdout } = await exec('pm2 jlist')
      return JSON.parse(stdout)
    }
  }
}

