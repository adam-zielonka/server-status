# Server Status

Server Status is a nodejs script for server monitoring. Tested only on Debian. Inspired by [eZ Server Monitor (eSM) `Web](https://www.ezservermonitor.com/esm-web/features).

![](https://screenshots.firefoxusercontent.com/images/1a773f64-85a7-4f93-9a90-e8dc37aaf54d.png)

## Configuration

### Backend
Create api/config.js or rename and edit api/sample-config.js.
```js
var config = {}

//Parametrs for app listening
config.web = {}
config.web.host = 'localhost'
config.web.port = 30097

//Access to apache virtual host
config.vhost = {}
config.vhost.user = 'user'
config.vhost.pass = 'pass'

//Services
config.hosts = [`218.108.149.373`,`localhost`] // Check all services whith this hosts
config.services = []
config.services.push({
  name: "Web Server", // Necessary
  port: 80, // Necessary
  host: [`example.com`], // Optional, list hosts to check
  link: `http://example.com/` // Optional
})

module.exports = config
```

### Frontend
Create www/src/config.js or rename and edit www/src/sample-config.js.
```js
export const Config = {
    modules: {
        system: true,
        fs: true,
        network: true,
        loadAverage: true,
        memory: true,
        cpu: true,
        pm2: true,
        vhost: true,
        services: true
    }
}
```

## Build project

```sh
# Build frontend
cd www
npm install
npm run build
cd ..

# Run backend
cd api
npm install
node status.js 
```

## Used in this project

### For backend

- **[nodejs](https://nodejs.org)**
- **[systeminformation](https://github.com/sebhildebrandt/systeminformation)**
- **[express](https://expressjs.com/)**
- **[request](https://github.com/request/request)**
- **[tcp-port-used](https://github.com/stdarg/tcp-port-used)**

### For frontend

- **[reactjs](https://reactjs.org/)**
- **[bootstrap](https://getbootstrap.com/)**
