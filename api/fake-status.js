const express = require('express')
const path = require('path')
const app = express()

app.use(express.static(path.join(__dirname, '../www/build/')))

app.get('/os/memory', function (req, res) {
  res.send({
    "total": 1038794752,
    "free": 157519872,
    "used": 880893952,
    "active": 613232640,
    "available": 220889088,
    "buffcache": 268042240,
    "swaptotal": 0,
    "swapused": 546840576,
    "swapfree": 1449644032
  })
})

app.get('/os/fs', function (req, res) {
  res.send([
    {
      "fs": "\/dev\/mapper\/vg-lv_root",
      "type": "ext4",
      "size": 18544627712,
      "used": 5639458816,
      "use": 30.41,
      "mount": "\/"
    },
    {
      "fs": "\/dev\/sda1",
      "type": "ext2",
      "size": 483364864,
      "used": 71109632,
      "use": 14.71,
      "mount": "\/boot"
    }
  ])
})

app.get('/os/network', function (req, res) {
  res.send([
    {
      "iface": "lo",
      "ip4": "127.0.0.1",
      "ip6": "::1",
      "mac": "",
      "internal": true,
      "stats": {
        "iface": "lo",
        "operstate": "unknown",
        "rx": 1079945544,
        "tx": 1079945544,
        "rx_sec": 2057.1340904788,
        "tx_sec": 2056.3855044143,
        "ms": 459533
      }
    },
    {
      "iface": "eth0",
      "ip4": "218.108.149.373",
      "ip6": "",
      "mac": "",
      "internal": false,
      "stats": {
        "iface": "eth0",
        "operstate": "up",
        "rx": 563106665,
        "tx": 273467790,
        "rx_sec": 518.76524778397,
        "tx_sec": 154.71399999565,
        "ms": 459493
      }
    }
  ])
})

app.get('/os/loadAverage', function (req, res) {
  res.send([
    0.83935546875,
    0.5943359375,
    0.16396484375
  ]);
})

var countServices = services => {
  var count = config.hosts ? services.length * config.hosts.length : 0
  for (service of services) {
    count += service.host ? service.host.length : 0
  }
  return count
}

app.get('/os/services', function (req, res) {
  res.send([
    {
      "name": "Web Server",
      "port": 80,
      "host": [
        "example.com"
      ],
      "link": "http:\/\/example.com\/",
      "open": {
        "example.com": true,
        "localhost": true,
        "218.108.149.373": false
      },
      "order": [
        "example.com",
        "218.108.149.373",
        "localhost"
      ]
    },
    {
      "name": "FTP Server",
      "port": 21,
      "host": [
        "ftp.example.com"
      ],
      "open": {
        "example.com": true,
        "localhost": true,
        "218.108.149.373": true
      },
      "order": [
        "ftp.example.com",
        "218.108.149.373",
        "localhost"
      ]
    },
    {
      "name": "Database Server",
      "port": 3306,
      "open": {
        "localhost": true,
        "218.108.149.373": false
      },
      "order": [
        "218.108.149.373",
        "localhost"
      ]
    }
  ])
})

app.get('/os/pm2', function (req, res) {
  res.send({
    "processes": [
      {
        "name": "App1",
        "pm2_env": {
          "node_version": "9.3.0",
          "restart_time": 30,
          "pm_uptime": 1514892168435,
          "status": "errored",
          "exec_mode": "fork_mode",
          "watch": true,
          "pm_id": 0
        },
        "pm_id": 0,
        "monit": {
          "memory": 44519424,
          "cpu": 4
        }
      },
      {
        "name": "App2",
        "pm2_env": {
          "node_version": "9.3.0",
          "restart_time": 7,
          "pm_uptime": 1514988290631,
          "status": "online",
          "exec_mode": "fork_mode",
          "watch": true,
          "pm_id": 0
        },
        "pm_id": 1,
        "monit": {
          "memory": 37909248,
          "cpu": 2
        }
      },
      {
        "name": "status",
        "pm2_env": {
          "node_version": "9.3.0",
          "restart_time": 0,
          "pm_uptime": 1515255329986,
          "status": "online",
          "exec_mode": "fork_mode",
          "watch": false,
          "pm_id": 0
        },
        "pm_id": 5,
        "monit": {
          "memory": 57909248,
          "cpu": 0
        }
      }
    ],
    "time": 1515344205556
  })
})

app.get('/os/system', function (req, res) {
  res.send({
    "platform": "Linux",
    "distro": "Debian GNU\/Linux",
    "release": "unknown",
    "codename": "",
    "kernel": "4.14.0-2-amd64",
    "arch": "x64",
    "hostname": "example.com",
    "logofile": "debian",
    "time": {
      "current": 1515344204171,
      "uptime": 452046,
      "timezone": "GMT+0100",
      "timezoneName": "CET"
    },
    "cpu": {
      "manufacturer": "Intel\u00ae",
      "brand": "Xeon\u00ae  E5-2650L v4",
      "vendor": "GenuineIntel",
      "family": "6",
      "model": "45",
      "stepping": "2",
      "revision": "",
      "speed": "1.70",
      "speedmin": "",
      "speedmax": "",
      "cores": 1,
      "cache": {
        "l1d": 32768,
        "l1i": 32768,
        "l2": 262144,
        "l3": 36700160
      }
    }
  })
})

app.get('/os/vhost', function (req, res) {
  res.send([
    {
      "port": "80",
      "name": "218.108.149.373",
      "statusCode": 200
    },
    {
      "port": "80",
      "name": "example.com",
      "statusCode": 200
    },
    {
      "port": "80",
      "name": "secret.example.com",
      "statusCode": 401
    },
    {
      "port": "80",
      "name": "error.example.com",
      "statusCode": 500
    }
  ])
})

app.listen(30098, `localhost`, () => {
  console.log(`Status on http://localhost:30098/`)
})
