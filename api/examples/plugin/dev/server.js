const ServerStatus = require('@server-status/api')

const folder = process.env.PROD ? '../dist/' : '../src/'

const config = {
  plugins: [
    {
      name: 'api-plugin',
      plugin: require(folder),
      config: {
        some_config: false,
      }
    },
  ],
}
 
ServerStatus(config).listen()
