import "@babel/polyfill"

import { ApolloServer } from 'apollo-server'
import typeDefs from './types'
import * as Queries from './resolvers'
import { login, getUserName } from './user'

const Mutation = {
  login
}

const resolvers = {
  ...Queries,
  Mutation
}

const server = new ApolloServer({ typeDefs, resolvers, context: getUserName })
server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})