const ServerStatus = require('./index')

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
    // {
    //   name: 'apache2',
    // },
    {
      name: 'caddy',
    },
    {
      name: 'services',
    },
    {
      name: 'pm2',
    },
  ],
  listen: {
    port: 4000,
    host: 'localhost',
  },
  // apolloServerConfig: {},
}

ServerStatus(config).listen()
