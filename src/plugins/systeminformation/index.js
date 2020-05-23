import * as resolvers from './resolvers'

module.exports = {
  typesPath: __dirname + '/types.gql',
  resolvers,
  query: {
    name: 'systeminformation',
    type: 'SystemInformation',
  }
}
