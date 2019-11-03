import { ApolloServer, gql } from 'apollo-server'

const ServerStatus = ({ plugins = [], listen = {}, apolloServerConfig = {} }) => {
  if (!plugins.length) {
    console.error('[ERROR] ⚠  You need to add min one plugin to run server')
    return { 
      listen: () => console.error('[ERROR] ⚠  Cannot listen of undefined')
    }
  }

  const Query = {}
  const resolversList = [{ Query }]
  const rootQueries = []
  const typeDefs = []
  const contextResolvers = []
  const rootResolvers = []

  const rootResolver = (parent, args, context, info) => (
    rootResolvers.reduce((result, resolver) => (
      {...result, ...resolver(parent, args, context, info, result)}), {}
    )
  )
  const context = (context) => contextResolvers.reduce((context, resolver) => resolver(context), context)
  const push = (array, element) => element && array.push(element)
  const rootQuery = ({ name, args, type }) => (name && type && `${name}${args && `(${args})` || ''}: ${type}`) || ''
  
  for (const pluginParams of plugins) {
    const plugin = pluginParams.plugin || require(pluginParams.name)
    const { query, config } = plugin
    if(pluginParams.config && config) config.setConfig(pluginParams.config)
    if(query && query.name) {
      Query[query.name] = (...args) => {
        return query.resolver && query.resolver(...args, rootResolver(...args)) || rootResolver(...args)
      }
      push(rootQueries, rootQuery(query))
    }
    push(resolversList, plugin.resolvers)
    push(typeDefs, plugin.types)
    push(contextResolvers, plugin.context)
    push(rootResolvers, plugin.root)
  }

  typeDefs.push(gql`
    type Query {
      ${rootQueries.join(' ')}
    }
  `)

  const resolvers = resolversList.reduce((a, b) => ({...a, ...b}))
  const server = new ApolloServer({ typeDefs, resolvers, context, ...apolloServerConfig })

  return {
    listen: (args) => {
      server.listen({ ...{ port: 4000 }, ...listen, ...args }).then(({ url }) => {
        console.log(`Server ready at ${url}`)
      })
    },
  }
}

ServerStatus.default = () => {
  console.warn('[WARN] ⚠ You try to use deleted way two run server')
  console.warn('[WARN] ⚠ Last version with ".default" is 0.0.3')
} 

module.exports = ServerStatus