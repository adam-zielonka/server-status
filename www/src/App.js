import React, { Component } from 'react'
import { Tools } from './Tools.js'
import { Config } from './config.js'
import './App.css'

const API = '/os/'

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      date: new Date()
    }
  }

  update() {
    this.setState({ date: new Date() })
  }

  render() {

    return (
      <div className="App">
        <nav className="navbar navbar-light bg-light justify-content-between sticky-top">
          <a className="navbar-brand" href="/">Status</a>
          <button type="button" onClick={(e) => this.update(e)} className="reload btn btn-info">Reload</button>
        </nav>
        <div className="container-fluid">
          <div className="row">
            <div className="col">
              <Box name="System" api="system" date={this.state.date} />
              <Box name="Files system" api="fs" date={this.state.date} />
              <Box name="Network" api="network" date={this.state.date} />
            </div>
            <div className="col">
              <Box name="Load Average" api="loadAverage" date={this.state.date} />
              <Box name="Memory" api="memory" date={this.state.date} />
              <Box name="CPU" api="cpu" date={this.state.date} />
            </div>
          </div>
          <div className="row">
            <div className="col">
              <Box name="PM2" api="pm2" date={this.state.date} />
            </div>
          </div>
          <div className="row">
            <div className="col">
              <Box name="VirtualHosts" api="vhost" date={this.state.date} />
            </div>
            <div className="col">
              <Box name="Services" api="services" date={this.state.date} />
            </div>
          </div>
        </div>
      </div>
    )
  }
}

class Box extends Component {
  constructor(props) {
    super(props)

    this.state = {
      array: [],
      obj: {},
      isLoading: false,
      error: false
    }
  }

  update() {
    this.setState({ isLoading: true })
    if(!this.state.isLoading)
    fetch(API + this.props.api, { credentials: 'same-origin' })
      .then(response => {
        if (response.ok) {
          return response.json()
        } else {
          throw new Error('Something went wrong ...')
        }
      })
      .then(data => this.setState(Array.isArray(data) 
      ? { array: data, isLoading: false, error: false } 
      : { obj: data, isLoading: false, error: false })
    ).catch(error => this.setState({error: true, isLoading: false }))
  }

  componentDidMount() {
    this.update()
  }

  componentDidUpdate(prevProps) {
    if (this.props.date > prevProps.date) {
      this.update()
    }
  }

  content(array, obj) {
    switch (this.props.api) {
      case 'system':
        return (
          <div>
            <table className="table table-striped table-sm">
              <tbody>
                <tr>
                  <td>Hostname</td>
                  <td>{obj.hostname}</td>
                </tr>
                <tr>
                  <td>OS</td>
                  <td>{obj.distro} {obj.release}</td>
                </tr>
                <tr>
                  <td>Kernel version</td>
                  <td>{obj.kernel}</td>
                </tr>
                <tr>
                  <td>Uptime</td>
                  <td>{obj.time ? Tools.getHumanTime(obj.time.uptime) : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      case 'memory':
        var swap = (
          <div>
            <table className="table table-striped table-sm">
              <tbody>
                <tr>
                  <td>Swap&nbsp;%</td>
                  <td className="w-100">
                    <div className="progress">
                      {Tools.getProgressBar(obj.swapused/obj.swaptotal)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>Used</td>
                  <td>{Tools.getHumanSize(obj.swapused)}</td>
                </tr>
                <tr>
                  <td>Free</td>
                  <td>{Tools.getHumanSize(obj.swapfree)}</td>
                </tr>
                <tr>
                  <td>Total</td>
                  <td>{Tools.getHumanSize(obj.swaptotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
        return (
          <div>
            <table className="table table-striped table-sm">
            <tbody>
              <tr>
                <td>Memory&nbsp;%</td>
                <td className="w-100">
                  <div className="progress">
                    {Tools.getProgressBar(obj.active/obj.total)}
                    {Tools.getProgressBar(obj.buffcache/obj.total, 'info')}
                  </div>
                </td>
              </tr>
              <tr>
                <td>Used</td>
                <td>{Tools.getHumanSize(obj.active)}</td>
              </tr>
              <tr>
                <td>Cached</td>
                <td>{Tools.getHumanSize(obj.buffcache)}</td>
              </tr>
              <tr>
                <td>Free</td>
                <td>{Tools.getHumanSize(obj.free)}</td>
              </tr>
              <tr>
                <td>Total</td>
                <td>{Tools.getHumanSize(obj.total)}</td>
              </tr>
            </tbody>
          </table>
          {obj.swaptotal ? swap : ''}
          </div>
        )
      case 'loadAverage':
        var time = [15, 5, 1]
        return (
          <div>
            <table className="table table-striped table-sm">
              <tbody>
                {array.map(avg => 
                  <tr>
                    <td>{time.pop()}&nbsp;min</td>
                    <td className="w-100">
                      <div className="progress">
                        {Tools.getProgressBar(avg)}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      case 'cpu':
        return (
          <div>
            <table className="table table-striped table-sm">
              <tbody>
                <tr>
                  <td>Model</td>
                  <td>{obj.manufacturer} {obj.brand}</td>
                </tr>
                <tr>
                  <td>Cores</td>
                  <td>{obj.cores}</td>
                </tr>
                <tr>
                  <td>Speed</td>
                  <td>{obj.speed}&nbsp;GHz</td>
                </tr>
                <tr>
                  <td>Cache</td>
                  <td>{obj.cache ? Tools.getHumanSize(obj.cache.l1d + obj.cache.l1i + obj.cache.l2 + obj.cache.l3) : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      case 'network':
       return (
         <div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>interface</th>
                  <th>IP</th>
                  <th>receive</th>
                  <th>transmit</th>
                </tr>
              </thead>
              <tbody>
                {array.map(net =>
                    <tr>
                      <td>{net.iface}</td>
                      <td>{net.ip4} {net.ip6}</td>
                      <td>{net.stats ? Tools.getHumanSize(net.stats.rx) : ''}</td>
                      <td>{net.stats ? Tools.getHumanSize(net.stats.tx) : ''}</td>
                    </tr>
                  )}
              </tbody>
            </table>
         </div>
       )
      case 'fs':
       return (
         <div>
          <table className="table table-sm">
            <thead>
              <tr>
                  <th>mount</th>
                  <th className="w-100">use</th>
                  <th>type</th>
                  <th>size</th>
                  <th>used</th>
                  <th>free</th>
              </tr>
            </thead>
            <tbody>
            {array.map(fs =>
                    <tr>
                      <td>{fs.mount}</td>
                      <td>
                        <div className="progress">
                          {Tools.getProgressBar(fs.use/100)}
                        </div>
                      </td>
                      <td>{fs.type}</td>
                      <td>{Tools.getHumanSize(fs.size)}</td>
                      <td>{Tools.getHumanSize(fs.used)}</td>
                      <td>{Tools.getHumanSize(fs.size-fs.used)}</td>
                    </tr>
                  )}
            </tbody>
        </table>
         </div>
       )
      case 'pm2':
       return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                    <th>App name</th>
                    <th>id</th>
                    <th>mode</th>
                    <th>status</th>
                    <th>restart</th>
                    <th>uptime</th>
                    <th>cpu</th>
                    <th>mem</th>
                    <th>user</th>
                    <th>watching</th>
                </tr>
              </thead>
              <tbody>
              {obj.processes ? obj.processes.map(app =>
                    <tr>
                      <td>{app.name}</td>
                      <td>{app.pm_id}</td>
                      <td>{app.pm2_env.exec_mode}</td>
                      <td>
                      <span className={"badge badge-" + (app.pm2_env.status == 'online' ? 'success' : 'danger')}>
                          {app.pm2_env.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{app.pm2_env.restart_time}</td>
                      <td>{Tools.getHumanTime((obj.time - app.pm2_env.pm_uptime) / 1000)}</td>
                      <td>{app.monit.cpu}%</td>
                      <td>{Tools.getHumanSize(app.monit.memory)}</td>
                      <td>{app.pm2_env.uid == undefined ? 'root' : app.pm2_env.uid}</td>
                      <td>
                        <span className={"badge badge-" + (app.pm2_env.watch ? 'success' : 'secondary')}>
                          {(app.pm2_env.watch ? 'enabled' : 'disabled').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ) : ''}
              </tbody>
            </table>
          </div>
        )
      case 'vhost':
        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                    <th>port</th>
                    <th>name</th>
                    <th>status code</th>
                </tr>
              </thead>
              <tbody>
                {array.map(host =>
                  <tr>
                    <td>{host.port}</td>
                    <td>
                      <a href={"http://"+(host.name)}>{host.name}</a>
                    </td>
                    <td>
                      <span className={"badge badge-" + (Tools.getColorByCode(host.statusCode))}>
                        {host.statusCode}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
          </div>
        )
      case 'services':
        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                    <th>port</th>
                    <th>host</th>
                    <th>name</th>
                </tr>
              </thead>
              <tbody>
                {array.map(service =>
                  <tr>
                    <td>{service.port}</td>
                    <td>
                      {service.order.map(host =>
                        <span className={"ml-1 badge badge-" + (service.open[host] ? 'success' : 'danger')}>
                          {host}
                        </span>
                      )}
                    </td>
                    <td>{service.name}</td>
                  </tr>
                )}
              </tbody>
              </table>
          </div>
        )
      default:
        return (
          <b><i>Not implemented!</i></b>
        )
    }

  }

  render() {
    if(!Config.modules[this.props.api]) return ''
    const { array, obj } = this.state;

    var classButton = 'btn-info'
    var styleCard = { opacity: 1 }

    if(this.state.isLoading) styleCard = {
        opacity: .4
    }
    if(this.state.error) classButton = 'btn-warning'

    return (
      <div className="card">
        <div className="card-header">
          <h4>
            {this.props.name}
            <button type="button" disabled={this.state.isLoading} onClick={(e) => this.update(e)} className={"reload btn float-right " + (classButton)}>Reload</button>
          </h4>
        </div>
        <div className="card-body" style={styleCard}>
          {this.content(array, obj)}
        </div>
      </div>
    )
  }
}

export default App
