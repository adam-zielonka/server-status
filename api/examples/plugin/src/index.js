import * as resolvers from './resolvers'
import * as config from './config'

module.exports = {
  typesPath: __dirname + '/types.gql',
  resolvers,
  config,
  query: {
    name: 'somePlugin',
    type: 'SomePlugin',
  }
}

