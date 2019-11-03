# Server Status API

GraphQL API server for retrieving server status information

## Use

Add `@server-status/api` to dependencies in package.json

```bash
$ npm install @server-status/api
```
or
```bash
$ yarn add @server-status/api
```

Create file e.g. `index.js`
```js
const ServerStatus = require('./index')

const config = {
  plugins: [
    {
      name: '@server-status/api-plugin-auth',
      config: {
        users: [
          {
            name: 'dragon',
            pass: 'dragon',
          }
        ],
        secret: 'pancake-is-the-best-dragon',
      }
    },
    {
      name: '@server-status/api-plugin-systeminformation',
    },
    {
      name: 'my-awesome-plugin',
      plugin: require('./myPlugins/my-awesome-plugin'),
    },
  ],
  listen: {
    port: 4000,
    host: 'localhost',
  },
  // apolloServerConfig: {},
}

ServerStatus(config).listen()

```
And run server
```bash
$ node index.js
```

## Licence

MIT
