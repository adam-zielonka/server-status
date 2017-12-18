const os = require('os');
var express = require('express')
var port = 30098
var host = 'localhost'

var app = express()

app.get('/', function (req, res) {
  res.sendFile('status.html', {root: __dirname })
})

app.get('/os/memory', function (req, res) {
  var json = {};
  json[`total`] = Math.round((os.totalmem()/1024/1024)*100)/100 + " MB"
  json[`free`] = Math.round((os.freemem()/1024/1024)*100)/100 + " MB"
  json[`used`] = Math.round(((os.totalmem() - os.freemem())/1024/1024)*100)/100 + " MB"
  json[`percent_used`] = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
  res.send(json);
})

app.get('/os/cpus', function (req, res) {
  res.send(os.cpus());
})

app.listen(port, host)
console.log(`Status on http://${host}:${port}/`)
