const ServerStatus = require('@server-status/api')

const folder = process.env.PROD ? '../dist/' : '../src/'

const config = {
  plugins: [
    {
      name: 'api-plugin',
      plugin: require(folder),
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
 
ServerStatus(config).listen()
