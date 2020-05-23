# Services plugin for Server Status API

GraphQL API for retrieving information about running services.

## Use

It is plugin so you need use the [`@server-status/api`](https://www.npmjs.com/package/@server-status/api) or you can adapt to yours [ApolloServer](https://www.apollographql.com/docs/apollo-server/). But if you choose my solution you need to do this steps: 

```bash
$ npm install @server-status/api @server-status/api-plugin-services
```
or
```bash
$ yarn add @server-status/api @server-status/api-plugin-services
```

Create file e.g. `index.js`
```js
const ServerStatus = require('@server-status/api')

const config = {
  plugins: [
    {
      name: '@server-status/api-plugin-services',
      config: {
        services: [
          {
            name: 'ServerStatus',
            port: '4000',
          },
          {
            name: 'OneTwoThere',
            port: '123',
          },
        ],
        hosts: [
          'localhost'
        ]
      }
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
