const ServerStatus = require('.')
const YAML = require('yaml')
const fs = require('fs')

try {
  const config = YAML.parse(fs.readFileSync('./src/config.yml', 'utf8'))

  ServerStatus(config).listen()
} catch (e) {
  console.log(e)
}

