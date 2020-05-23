import 'regenerator-runtime/runtime'
import * as resolvers from './resolvers'
import * as config from './config'

module.exports = {
  typesPath: __dirname + '/types.gql',
  resolvers,
  config,
  query: {
    name: 'apache2',
    type: 'Apache2',
  }
}

