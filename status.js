const os = require('os');
const si = require('systeminformation');
const { exec } = require('child_process');
const config = require('./config');
const express = require('express')
const request = require('request');
const app = express()
const tcpPortUsed = require('tcp-port-used');

app.get('/', function (req, res) {
  res.sendFile('status.html', {root: __dirname })
})

app.get('/os/memory', function (req, res) {
  si.mem().then(data => res.send(data))
    .catch(error => res.status(500).send(error));
})

app.get('/os/cpu', function (req, res) {
  si.cpu().then(data => res.send(data))
    .catch(error => res.status(500).send(error));
})

app.get('/os/fs', function (req, res) {
  si.fsSize().then(data => res.send(data))
    .catch(error => res.status(500).send(error));
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
      });
    }
  }).catch(error => res.status(500).send(error));
})

app.get('/os/load-average', function (req, res) {
  res.send(os.loadavg());
})

app.get('/os/services', function (req, res) {
  if(config.services && config.services.length > 0) {
    var count = config.services.length*2;
    for(let i=0; i<config.services.length; i++) {
      tcpPortUsed.check(config.services[i])
      .then(function(inUse) {
          config.services[i].status = inUse
          if(--count < 1) res.send(config.services)
      }, function(err) {
          if(--count < 1) res.send(config.services)
      });
      tcpPortUsed.check(config.services[i].port,`127.0.0.1`)
      .then(function(inUse) {
          config.services[i].localhost = inUse
          if(--count < 1) res.send(config.services)
      }, function(err) {
          if(--count < 1) res.send(config.services)
      });
    }
  } else res.status(500).send("500")

})

app.get('/os/pm2', function (req, res) {
  exec('pm2 jlist', (error, stdout, stderr) => {
    if(!error) {
      var pm2 = {}
      pm2.processes = JSON.parse(stdout)
      pm2.time = Date.now()
      res.send(pm2);
    } else res.status(500).send(error)
  })
})

app.get('/os/system', function (req, res) {
  si.osInfo().then(data => {
    data.time = si.time()
    res.send(data)
  }).catch(error => res.status(500).send(error))
})

app.get('/os/vhost', function (req, res) {
  exec('apache2ctl -t -D DUMP_VHOSTS', (error, stdout, stderr) => {
    if(!error) {
      var vhost = []
      for (var row of stdout.split('\n')) {
        if(row.match(/^\s.*port/)) {
          var one = {}
          var port = false;
          var name = false;
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
      var count = vhost.length;
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
