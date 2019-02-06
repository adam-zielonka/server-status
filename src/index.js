import "@babel/polyfill"

import { ApolloServer } from 'apollo-server'
import typeDefs from './types'
import * as Queries from './resolvers/sysinfo'
import { auth, login, getUserName } from './user'

const Query = {
  sysinfo: auth
}

const Mutation = {
  login
}

const resolvers = {
  Query,
  ...Queries,
  Mutation
}

const server = new ApolloServer({ typeDefs, resolvers, context: getUserName })
server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})