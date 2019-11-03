import types from './types'
import * as resolvers from './resolvers'
import { getServices } from './services'
import * as config from './config'

module.exports = {
  types,
  resolvers,
  config,
  query: {
    name: 'services',
    type: '[Service]',
    resolver: () => getServices(),
  }
}

