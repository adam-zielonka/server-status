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
const ServerStatus = require('@server-status/api')

const config = {
  plugins: [
    {
      name: 'auth',
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
      name: 'systeminformation',
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

## Built-in plugins

- ### apache2
Plugin for retrieving information about running virtual host via apache2.
```js
const config = {
  plugins: [
    {
      name: 'apache2',
      // config: {
      //   user: 'username',
      //   pass: 'password',
      // }
    },
  ],
}
```
- ### auth
Plugin for for simple authorization to server-status
```js
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
  ],
}
```
- ### caddy
Plugin for retrieving information about running virtual host via [Caddy Server](https://caddyserver.com/).
```js
const config = {
  plugins: [
    {
      name: '@server-status/api-plugin-caddy',
      // config: {
      //   user: 'username',
      //   pass: 'password',
      //   port: 2019,
      // }
    },
  ],
}
```
- ### pm2
Plugin for retrieving information about running app via [PM2](https://pm2.io/).
```js
const config = {
  plugins: [
    {
      name: '@server-status/api-plugin-pm2',
    },
  ],
}
```
- ### service
Plugin for retrieving information about running services.
```js
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
```
- ### systeminformation
Plugin for retrieving server system information from package [systeminformation](https://systeminformation.io/).  
```js
const config = {
  plugins: [
    {
      name: '@server-status/api-plugin-systeminformation',
    },
  ],
}
```
- ### status
Plugin for retrieving information about running plugins. Auto loaded.

### Using YAML instead of JSON

```bash
yarn add @server-status/api yaml
```

```js
const ServerStatus = require('@server-status/api')
const YAML = require('yaml')
const fs = require('fs')

try {
  const config = YAML.parse(fs.readFileSync('./config.yml', 'utf8'))

  ServerStatus(config).listen()
} catch (e) {
  console.log(e)
}
```

## Licence

MIT
