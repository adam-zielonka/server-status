import "@babel/polyfill"

import { ApolloServer } from 'apollo-server'
import typeDefs from './types'
import * as Queries from './resolvers/sysinfo'
import { auth, login, getUserName } from './user'
import { setConfig } from "./tools"

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

const ServerStatus = (config, apolloServerConfig = {}) => {
  const CONFIG = setConfig(config)

  const server = new ApolloServer({ typeDefs, resolvers, context: getUserName, ...apolloServerConfig })

  const listenProps = CONFIG.WEB.localhost ? { host: 'localhost' } : {}

  return {
    listen: (props = {}) => {
      server.listen({ port: CONFIG.WEB.port,  ...props}).then(({ url }) => {
        console.log(`Server ready at ${url}`)
      })
    }
  }
}


export default ServerStatus
