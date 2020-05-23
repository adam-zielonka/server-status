import 'regenerator-runtime/runtime'
import * as config from './config'
import { auth, login, getUserName } from './user'

module.exports = {
  typesPath: __dirname + '/types.gql',
  config,
  query: {
    name: 'login',
    args: 'name: String!, pass: String!',
    type: 'AuthPayload',
    resolver: login,
  },
  context: getUserName,
  root: auth,
}

