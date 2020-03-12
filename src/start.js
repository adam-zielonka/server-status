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
    // {
    //   name: 'apache2',
    //   plugin: require('../../api-plugin-apache2'),
    // },
    {
      name: 'caddy',
      plugin: require('../../api-plugin-caddy'),
    },
    {
      name: 'services',
      plugin: require('../../api-plugin-services'),
    },
    {
      name: 'pm2',
      plugin: require('../../api-plugin-pm2'),
    },
  ],
  listen: {
    port: 4000,
    host: 'localhost',
  },
  // apolloServerConfig: {},
}

ServerStatus(config).listen()
