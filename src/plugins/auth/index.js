import types from './types'
import * as config from './config'
import { auth, login, getUserName } from './user'

module.exports = {
  types,
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

