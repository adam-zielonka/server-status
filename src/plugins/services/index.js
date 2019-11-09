import * as resolvers from './resolvers'
import { getServices } from './services'
import * as config from './config'

module.exports = {
  typesPath: __dirname + '/types.gql',
  resolvers,
  config,
  query: {
    name: 'services',
    type: '[Service]',
    resolver: () => getServices(),
  }
}

