const os = require('os');
var express = require('express')
var shell = require('shelljs');
var port = 30098
var host = 'localhost'

var app = express()

app.get('/', function (req, res) {
  res.sendFile('status.html', {root: __dirname })
})

app.get('/os/memory', function (req, res) {
  var free = shell.exec('grep ^MemFree /proc/meminfo | awk \'{print $2}\'',{silent:true}).stdout;
  var buffers = shell.exec('grep ^Buffers /proc/meminfo | awk \'{print $2}\'',{silent:true}).stdout;
  var cached = shell.exec('grep ^Cached /proc/meminfo | awk \'{print $2}\'',{silent:true}).stdout;
  free = parseInt(free) + parseInt(buffers) + parseInt(cached)
  var json = {}
  json[`total`] = Math.round((os.totalmem()/1024/1024)*100)/100 + " MB"
  json[`free`] = Math.round((free/1024)*100)/100 + " MB"
  json[`used`] = Math.round(((os.totalmem() - free)/1024/1024)*100)/100 + " MB"
  json[`percent_used`] = Math.round(((os.totalmem() - free*1024) / os.totalmem()) * 100)
  res.send(json)
})

app.get('/os/cpus', function (req, res) {
  res.send(os.cpus());
})

app.listen(port, host)
console.log(`Status on http://${host}:${port}/`)
