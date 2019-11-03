const ServerStatus = require('./index')

const config = {
  plugins: [
    {
      name: './plugins/auth',
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
      plugin: require('./plugins/systeminformation'),
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
    // {
    //   name: './plugins/legacy',
    // }
  ],
  listen: {
    port: 4000,
    host: 'localhost',
  },
  // apolloServerConfig: {},
}

ServerStatus(config).listen()