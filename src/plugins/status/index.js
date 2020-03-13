import * as resolvers from './resolvers'

module.exports = {
  typesPath: __dirname + '/types.gql',
  resolvers,
  query: {
    name: 'serverstatus',
    type: 'ServerStatus',
  }
}

