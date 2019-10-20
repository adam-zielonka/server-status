/* eslint-disable object-curly-newline */
/* eslint-disable max-classes-per-file */
import React, { Component } from 'react'
import { Tools } from './Tools'

export class DashBoard extends Component {
  constructor(props) {
    super(props)

    this.state = {
      date: new Date(),
      inited: false,
      firstRun: false,
      error: false,
    }
  }

  update() {
    this.setState({ date: new Date() })
  }


  async firstRun() {
    const { store } = this.props
    const { getData } = store

    this.setState({ firstRun: true })

    const query = `{
      sysinfo {
        system {
          hostname
        }
      }
    }`

    const { data, errors } = await getData({ query })

    if (errors && errors.length) this.setState({ error: true })
    else if (data) this.setState({ inited: true })
  }


  render() {
    const store = this.props.store
    const { inited, firstRun, date, error } = this.state

    if (!store.user.token) {
      return (
        <div className="App">
          <div className="container-fluid">
            <h3>Waiting...</h3>
          </div>
        </div>
      )
    }

    if (!inited) {
      if (!firstRun) this.firstRun()
      return (
        <div className="App">
          <div className="container-fluid">
            <h3>{!error ? 'Loading...' : 'Connection error'}</h3>
          </div>
        </div>
      )
    } return (
      <div className="App">
        <nav className="navbar navbar-light bg-light justify-content-between sticky-top">
          <a className="navbar-brand" href="/">Server Status</a>
          <button type="button" onClick={e => this.update(e)} className="reload btn btn-info">Reload</button>
        </nav>
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-12 col-md-12 col-lg-12 col-xl-4">
              <Box store={store} name="System" api="system" date={date} />
              <Box store={store} name="Load Average" api="loadAverage" date={date} />
              <Box store={store} name="Memory" api="memory" date={date} />
            </div>
            <div className="col">
              <div className="row">
                <div className="col">
                  <Box store={store} name="PM2" api="pm2" date={date} />
                </div>
              </div>
              <div className="row">
                <div className="col-sm-12 col-md-6 col-lg-6 col-xl-6">
                  <Box store={store} name="Files system" api="fs" date={date} />
                  <Box store={store} name="Services" api="services" date={date} />
                </div>
                <div className="col-sm-12 col-md-6 col-lg-6 col-xl-6">
                  <Box store={store} name="Network" api="network" date={date} />
                  <Box store={store} name="VirtualHosts" api="vhosts" date={date} />
                </div>
              </div>
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
      error: false,
      apps: {},
    }
  }

  componentDidMount() {
    this.update()
  }

  componentDidUpdate(prevProps) {
    if (this.props.date > prevProps.date) {
      this.update()
    }
  }

  setUnsetState(name) {
    const {apps} = this.state
    apps[name] = !apps[name]
    this.setState({ apps })
  }

  async update() {
    const { store } = this.props
    const { getData } = store

    this.setState({ isLoading: true })

    const query = `{
      sysinfo {
        data: ${this.props.api} ${this.query()}
      }
    }`

    const { data, errors } = await getData({ query })

    if (errors && errors.length) this.setState({ error: true, isLoading: false })
    else if (data && data.sysinfo) {
      this.setState(Array.isArray(data.sysinfo.data)
        ? { array: data.sysinfo.data, isLoading: false, error: false }
        : { obj: data.sysinfo.data, isLoading: false, error: false })
    }
  }

  query() {
    switch (this.props.api) {
    case 'system': return '{ platform distro release codename arch hostname kernel }'
    case 'loadAverage': return ''
    case 'memory': return '{ total free used active available buffcache swaptotal swapused swapfree }'
    case 'pm2': return `{
      name
      pm2_env {
        exec_mode
        status
        watch
        pm_uptime
        restart_time
      }
      monit { 
        memory
        cpu
      }
      pm_id
    }`
    case 'fs': return '{ fs type size used use mount }'
    case 'services': return `{
      name
      port
      link
      hosts {
        name
        port
        open
      }
    }`
    case 'network': return `{
      iface
      ip4
      ip6
      mac
      internal
      networkStats { 
      	iface
        operstate
        rx
        tx
        rx_sec
        tx_sec
        ms
      }
    }`
    case 'vhosts': return `{ port name statusCode }`
    default: return ''
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
                <td>
                  {obj.distro} 
                  {' '}
                  {obj.release}
                </td>
              </tr>
              <tr>
                <td>Kernel version</td>
                <td>{obj.kernel}</td>
              </tr>
              <tr>
                <td>Uptime</td>
                <td>{obj.time && Tools.getHumanTime(obj.time.uptime)}</td>
              </tr>
              <tr>
                <td>CPU</td>
                <td>
                  {obj.cpu && `${obj.cpu.cores}x ${obj.cpu.manufacturer} ${obj.cpu.brand} @ ${obj.cpu.speed}\u00A0GHz`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    case 'memory':
      const memory = [
        <table className="table table-striped table-sm">
          <tbody>
            <tr>
              <td colSpan="4">
                <div className="progress">
                  {Tools.getProgressBar(obj.active / obj.total)}
                  {Tools.getProgressBar(obj.buffcache / obj.total, 'info')}
                </div>
              </td>
            </tr>
            <tr>
              <td>Used</td>
              <td>Cached</td>
              <td>Free</td>
              <td>Total</td>
            </tr>
            <tr>
              <td>{Tools.getHumanSize(obj.active)}</td>
              <td>{Tools.getHumanSize(obj.buffcache)}</td>
              <td>{Tools.getHumanSize(obj.free)}</td>
              <td>{Tools.getHumanSize(obj.total)}</td>
            </tr>
          </tbody>
        </table>,
      ]
      if (obj.swaptotal) {memory.push(
        <table className="table table-striped table-sm">
          <tbody>
            <tr>
              <td colspan="4">
                <div className="progress">
                  {Tools.getProgressBar(obj.swapused/obj.swaptotal)}
                </div>
              </td>
            </tr>
            <tr>
              <td>&nbsp;</td>
              <td>Used</td>
              <td>Free</td>
              <td>Total</td>
            </tr>
            <tr>
              <td>Swap</td>
              <td>{Tools.getHumanSize(obj.swapused)}</td>
              <td>{Tools.getHumanSize(obj.swapfree)}</td>
              <td>{Tools.getHumanSize(obj.swaptotal)}</td>
            </tr>
            <tr>
            </tr>
          </tbody>
        </table>
      )}
      return memory
    case 'loadAverage':
      var time = [15, 5, 1]
      return (
        <div>
          <table className="table table-striped table-sm">
            <tbody>
              {array.map(avg => (
                <tr>
                  <td>{time.pop()}&nbsp;min</td>
                  <td className="w-100">
                    <div className="progress">
                      {Tools.getProgressBar(avg)}
                    </div>
                  </td>
                </tr>
              ))}
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
              {array.map(net => (
                <tr>
                  <td>{net.iface}</td>
                  <td>{net.ip4} {net.ip6}</td>
                  <td>{net.networkStats ? Tools.getHumanSize(net.networkStats.rx) : ''}</td>
                  <td>{net.networkStats ? Tools.getHumanSize(net.networkStats.tx) : ''}</td>
                </tr>
              ))}
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
              {array.map(fs => (
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
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'pm2':
      const pm2_ls = []
      const pm2_ls_all = []
      if (array) {
        array.forEach(app => {
          let exist = false
          for (const pm2_app of pm2_ls) {
            if (pm2_app.name === app.name
              && app.pm2_env.exec_mode === 'cluster_mode'
              && pm2_app.pm2_env.exec_mode === 'cluster_mode') {
              exist = true
              pm2_app.counter++
              pm2_app.monit.memory += app.monit.memory
              pm2_app.monit.cpu += app.monit.cpu
              pm2_app.online += app.pm2_env.status === 'online' ? 1 : 0
              pm2_app.pm2_env.status = app.pm2_env.status === 'online' ? 'online' : 'stopped'
              if (app.pm2_env.watch) pm2_app.pm2_env.watch = true
              pm2_app.pm2_env.pm_uptime = Math.min(pm2_app.pm2_env.pm_uptime, app.pm2_env.pm_uptime)
              pm2_app.apps.push(app)
            }
          }
          if (!exist) {
            if (app.pm2_env.exec_mode === 'cluster_mode') {
              pm2_ls.push({
                name: app.name,
                counter: 1,
                online: app.pm2_env.status === 'online' ? 1 : 0,
                apps: [app],
                monit: {
                  cpu: app.monit.cpu,
                  memory: app.monit.memory,
                },
                pm2_env: {
                  status: app.pm2_env.status === 'online' ? 'online' : 'stopped',
                  exec_mode: 'cluster_mode',
                  pm_uptime: app.pm2_env.pm_uptime,
                  watch: app.pm2_env.watch,
                },
              })
            } else {
              pm2_ls.push(app)
            }
          }
        })
        pm2_ls.forEach(app => {
          pm2_ls_all.push(app)
          if (app.apps) app.apps.forEach(subapp => pm2_ls_all.push(subapp))
        })
      }
      return (
        <div>
          <table className="table table-sm">
            <thead>
              <tr>
                <th>+</th>
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
              {pm2_ls_all ? pm2_ls_all.map(app => (
                <tr key={app.name + app.pm_id} style={{ visibility: !app.counter && app.pm2_env.exec_mode === 'cluster_mode' && !this.state.apps[app.name] ? 'collapse' : 'visible', 
                  background: !app.counter && app.pm2_env.exec_mode === 'cluster_mode' ? 'lightgray' : ''}}>
                  <td> 
                    {
                      app.counter ? (
                        <button className={"btn btn-primary btn-xs pt-0 pb-0"} onClick={this.setUnsetState.bind(this, app.name)}>{app.counter}x</button>
                      ) : ''
                    }
                  </td>
                  <td>{app.name}</td>
                  <td>{app.pm_id}</td>
                  <td>{app.pm2_env.exec_mode}</td>
                  <td>
                    <span className={"badge badge-" + (app.pm2_env.status === 'online' ? 'success' : 'danger')}>
                      {app.counter ? Tools.round((app.online/app.counter)*100, 0) + '%' : ''} {app.pm2_env.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{app.pm2_env.restart_time}</td>
                  <td>{Tools.getHumanTime((obj.time - app.pm2_env.pm_uptime) / 1000)}</td>
                  <td>{Tools.round(app.monit.cpu, 1)}%</td>
                  <td>{Tools.getHumanSize(app.monit.memory)}</td>
                  <td>{app.pm2_env.uid === undefined ? 'root' : app.pm2_env.uid}</td>
                  <td>
                    <span className={"badge badge-" + (app.pm2_env.watch ? 'success' : 'secondary')}>
                      {(app.pm2_env.watch ? 'enabled' : 'disabled').toUpperCase()}
                    </span>
                  </td>
                </tr>
              )) : ''}
            </tbody>
          </table>
        </div>
      )
    case 'vhosts':
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
              {array.map(host => (
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
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'services':
      // eslint-disable-next-line no-case-declarations
      const getBadgeColor = open => (open ? {
        background: 'green',
        color: 'white',
      } : {
        background: 'red',
        color: 'white',
      })

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
              {array.map(service => (
                <tr>
                  <td>{service.port}</td>
                  <td>
                    {service.hosts.map(host =>
                      <>
                      <span style={getBadgeColor(host.open)} className={"ml-1 badge badge-" + (host.open ? 'success' : 'danger')}>
                        &nbsp;{host.name}&nbsp;
                        </span>
                        &nbsp;
                      </>
                    )}
                  </td>
                  <td>{service.name}</td>
                </tr>
              ))}
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
    // if (!Config.modules[this.props.api]) return ''
    const { array, obj } = this.state

    var classButton = 'btn-info'
    let styleCard = { opacity: 1 }

    if (this.state.isLoading) {styleCard = {
      opacity: .4
    }}
    if (this.state.error) classButton = 'btn-warning'

    return (
      <div className="card">
        <div className="card-header">
          <h4>
            {this.props.name}
            <button type="button" disabled={this.state.isLoading} onClick={e => this.update(e)} className={'reload btn float-right ' + (classButton)}>Reload</button>
          </h4>
        </div>
        <div className="card-body" style={styleCard}>
          {this.content(array, obj)}
        </div>
      </div>
    )
  }
}
