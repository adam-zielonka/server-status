# PM2 plugin for Server Status API

GraphQL API for retrieving information about running app via [PM2](https://pm2.io/).

## Use

It is plugin so you need use the [`@server-status/api`](https://www.npmjs.com/package/@server-status/api) or you can adapt to yours [ApolloServer](https://www.apollographql.com/docs/apollo-server/). But if you choose my solution you need to do this steps: 

```bash
$ npm install @server-status/api @server-status/api-plugin-pm2
```
or
```bash
$ yarn add @server-status/api @server-status/api-plugin-pm2
```

Create file e.g. `index.js`
```js
const ServerStatus = require('@server-status/api')

const config = {
  plugins: [
    {
      name: '@server-status/api-plugin-pm2',
    },
  ],
}

ServerStatus(config).listen()

```
And run server
```bash
$ node index.js
```

## Licence

MIT
