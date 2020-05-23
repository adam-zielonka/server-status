import 'regenerator-runtime/runtime'
import { execSync } from 'child_process'

module.exports = {
  typesPath: __dirname + '/types.gql',
  query: {
    name: 'pm2',
    type: '[PM2]',
    resolver: async () => JSON.parse(await execSync('pm2 jlist')),
  }
}

