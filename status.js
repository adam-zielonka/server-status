const os = require('os');
var express = require('express')
var shell = require('shelljs');
var port = 30097
var host = 'localhost'

var app = express()

app.get('/', function (req, res) {
  res.sendFile('status.html', {root: __dirname })
})

app.get('/os/memory', function (req, res) {
  var free = parseInt(shell.exec('grep ^MemFree /proc/meminfo | awk \'{print $2}\'',{silent:true}).stdout)
  var buffers = parseInt(shell.exec('grep ^Buffers /proc/meminfo | awk \'{print $2}\'',{silent:true}).stdout)
  var cached = parseInt(shell.exec('grep ^Cached /proc/meminfo | awk \'{print $2}\'',{silent:true}).stdout)
  total_free = free + buffers + cached
  var json = {}
  json[`total`] = Math.round((os.totalmem()/1024/1024)*100)/100 + " MB"
  json[`total_free`] = Math.round((total_free/1024)*100)/100 + " MB"
  json[`free`] = Math.round((free/1024)*100)/100 + " MB"
  json[`buffers`] = Math.round((buffers/1024)*100)/100 + " MB"
  json[`cached`] = Math.round((cached/1024)*100)/100 + " MB"
  json[`used`] = Math.round(((os.totalmem() - total_free)/1024/1024)*100)/100 + " MB"
  json[`percent_used`] = Math.round(((os.totalmem() - total_free*1024) / os.totalmem()) * 100)
  json[`percent_buffers`] = Math.round(((buffers*1024) / os.totalmem()) * 100)
  json[`percent_cached`] = Math.round(((cached*1024) / os.totalmem()) * 100)
  res.send(json)
})

app.get('/os/cpus', function (req, res) {
  res.send(os.cpus());
})

app.get('/os/load-average', function (req, res) {
  res.send(os.loadavg());
})

app.get('/os/pm2', function (req, res) {
  var pm2 = {}
  pm2.processes = JSON.parse(shell.exec('pm2 jlist',{silent:true}).stdout)
  pm2.time = Date.now()
  res.send(pm2);
})

app.listen(port, host)
console.log(`Status on http://${host}:${port}/`)
