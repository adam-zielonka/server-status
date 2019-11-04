const ServerStatus = require('./index')

const config = {
  plugins: [
    {
      name: 'auth',
      plugin: require('../../api-plugin-auth'),
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
      plugin: require('../../api-plugin-systeminformation'),
    },
    {
      name: './plugins/apache2',
    },
    {
      name: './plugins/services',
    },
    {
      name: './plugins/pm2',
    },
  ],
  listen: {
    port: 4000,
    host: 'localhost',
  },
  // apolloServerConfig: {},
}

ServerStatus(config).listen()
