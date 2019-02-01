import "@babel/polyfill"

import { ApolloServer } from 'apollo-server'
import typeDefs from './types'
import * as resolvers from './resolvers'

const server = new ApolloServer({ typeDefs, resolvers })
server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})