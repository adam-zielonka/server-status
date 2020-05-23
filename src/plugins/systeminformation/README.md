# System Information plugin for Server Status API

GraphQL API for retrieving server system information from package [systeminformation](https://systeminformation.io/).  
Work in progress. Only small part of systeminformation package had been rewritten.

## Use

It is plugin so you need use the [`@server-status/api`](https://www.npmjs.com/package/@server-status/api) or you can adapt to yours [ApolloServer](https://www.apollographql.com/docs/apollo-server/). But if you choose my solution you need to do this steps: 

```bash
$ npm install @server-status/api @server-status/api-plugin-systeminformation
```
or
```bash
$ yarn add @server-status/api @server-status/api-plugin-systeminformation
```

Create file e.g. `index.js`
```js
const ServerStatus = require('@server-status/api')

const config = {
  plugins: [
    {
      name: '@server-status/api-plugin-systeminformation',
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
