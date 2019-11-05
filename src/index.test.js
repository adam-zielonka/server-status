const ServerStatus = require('./index')

test('no server crash', () => {
  ServerStatus({})
})
