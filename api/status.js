const os = require('os')
const si = require('systeminformation')
const { exec } = require('child_process')
const config = require('./config')
const express = require('express')
const request = require('request')
const tcpPortUsed = require('tcp-port-used')
const path = require('path')

const app = express()
app.use(express.static(path.join(__dirname, '../www/build/')))

if(config.web.cross_origin) {
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    next()
  })
}

app.get('/os/memory', function (req, res) {
  si.mem().then(data => res.send(data))
    .catch(error => res.status(500).send(error))
})

app.get('/os/cpu', function (req, res) {
  si.cpu().then(data => res.send(data))
    .catch(error => res.status(500).send(error))
})

app.get('/os/fs', function (req, res) {
  si.fsSize().then(data => res.send(data))
    .catch(error => res.status(500).send(error))
})

app.get('/os/network', function (req, res) {
  si.networkInterfaces().then(data => {
    var count = data.length
    for(let i=0; i<data.length; i++){
      si.networkStats(data[i].iface).then(stats => {
          data[i].stats = stats
          if(--count < 1) res.send(data)
      }, err => {
          if(--count < 1) res.send(data)
      })
    }
  }).catch(error => res.status(500).send(error))
})

app.get('/os/loadAverage', function (req, res) {
  res.send(os.loadavg())
})

var countServices = services => {
  var count = config.hosts ? services.length * config.hosts.length : 0
  for (service of services) {
    count += service.host ? service.host.length : 0
  }
  return count
}

app.get('/os/services', function (req, res) {
  if(config.services && config.services.length > 0) {
    var count = countServices(config.services)
    for(let i=0; i<config.services.length; i++) {
      if(!config.services[i].open) config.services[i].open = {}
      var array = []
      array = array.concat(config.services[i].host ? config.services[i].host : [])
      array = array.concat(config.hosts ? config.hosts : [])
      config.services[i].order = array
      if(config.services[i].host) for (let j=0; j<config.services[i].host.length; j++) {
        tcpPortUsed.check(config.services[i].port, config.services[i].host[j])
        .then(function(inUse) {
            config.services[i].open[config.services[i].host[j]] = inUse
            if(--count < 1) res.send(config.services)
        }, function(err) {
            if(--count < 1) res.send(config.services)
        })
      }
      if(config.hosts) for (let j=0; j<config.hosts.length; j++) {
        tcpPortUsed.check(config.services[i].port, config.hosts[j])
        .then(function(inUse) {
            config.services[i].open[config.hosts[j]] = inUse
            if(--count < 1) res.send(config.services)
        }, function(err) {
            if(--count < 1) res.send(config.services)
        })
      }
    }
  } else res.status(500).send("500")

})

app.get('/os/pm2', (req, res) => {
  exec('pm2 jlist', (error, stdout, stderr) => {
    if(!error) res.send({
        processes : JSON.parse(stdout),
        time: Date.now()
    })
    else res.status(500).send(error)
  })
})

app.get('/os/system', function (req, res) {
  si.osInfo().then(data => {
    data.time = si.time()
    si.cpu().then(data2 => {
      data.cpu = data2
      res.send(data)
    }).catch(error => res.status(500).send(error))
  }).catch(error => res.status(500).send(error))
})

app.get('/os/vhost', function (req, res) {
  exec('apache2ctl -t -D DUMP_VHOSTS', (error, stdout, stderr) => {
    if(!error) {
      var vhost = []
      for (var row of stdout.split('\n')) {
        if(row.match(/^\s.*port/)) {
          var one = {}
          var port = false
          var name = false
          for(var v of row.split(' '))
            if(v) {
              if(port) {
                one.port = v
                port = false
              }
              if(name) {
                one.name = v
                name = false
              }
              if(v == "port") port = true
              if(v == "namevhost") name = true
            }
            if(one) vhost.push(one)
        }
      }
      var auth = () => {
        if(config.vhost && config.vhost.user) return {
        'auth': {
          'user': config.vhost.user,
          'pass': config.vhost.pass,
          'sendImmediately': false
        }}
        return {}
      }
      var count = vhost.length
      for(let i=0; i<vhost.length; i++) {
        request(`http://${vhost[i].name}:${vhost[i].port}`, auth(), (error, response, body) => {
          vhost[i].statusCode = error ? error.code : response.statusCode
          if(--count < 1) res.send(vhost)
        })
      }
    } else res.status(500).send(error)
  })
})

app.listen(config.web.port, config.web.host, () => {
  console.log(`Status on http://${config.web.host}:${config.web.port}/`)
})
