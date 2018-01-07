var config = {}

config.web = {}
config.web.host = 'localhost'
config.web.port = 30097

config.vhost = {}
config.vhost.user = 'user'
config.vhost.pass = 'pass'

config.hosts = [`218.108.149.373`,`localhost`]
config.services = []
config.services.push({
  name: "Web Server",
  port: 80,
  host: [`example.com`],
  link: `http://example.com/`
})
config.services.push({
  name: "FTP Server",
  port: 21,
  host: [`ftp.example.com`]
})
config.services.push({
  name: "Database Server",
  port: 3306
})
module.exports = config
