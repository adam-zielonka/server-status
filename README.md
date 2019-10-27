# Server Status API

API for retrieving server status information

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
const config = {
  USERS: [
    {
        name: 'pancake',
        pass: 'pancake',
    },
  ],
  APP_SECRET: 'pancake-is-the-best-dragon',
  SERVICES: [
    {
        name: "Web Server",
        port: 80,
    },
    {
        name: "SSH",
        port: 22
    },
    {
        name: "API",
        port: 4000
    },
  ],
  VHOST: {
    user: 'pancake',
    pass: 'pancake',
  },
  WEB: {
    localhost: false,
    port: 4000,
  },
  HOSTS: [
    `localhost`,
  ]
  
}

const server = require('@server-status/api').default(config /*, apolloServerConfig*/)

server.listen()
```
And run server
```bash
$ node index.js
```


## Frontend app

Go to [gitlab.com/server-status/server-status-app](https://gitlab.com/server-status/server-status-app)

## Licence

MIT
