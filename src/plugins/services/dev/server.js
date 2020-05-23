const ServerStatus = require('@server-status/api')

const folder = process.env.PROD ? '../dist/' : '../src/'

const config = {
  plugins: [
    {
      name: 'api-plugin',
      plugin: require(folder),
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
