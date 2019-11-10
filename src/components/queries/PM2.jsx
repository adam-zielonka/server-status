import React, { useState } from 'react'
import Query from '../Query'
import * as Tools from '../Tools'
import { Badge } from '../Badge'

const PM2 = () => {
  const query = `{ 
    pm2 {
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
    }
    si: systeminformation {
      time {
        current
      }
    }
  }`

  const [state, setState] = useState({ apps: {} })

  const setUnsetState = name => {
    const { apps } = state
    apps[name] = !apps[name]
    setState({ apps })
  }

  return (
    <Query query={query} title="PM2">
      {response => {
        let array = []
        if (response && response.pm2)
          array = Array.isArray(response.pm2) ? response.pm2 : []
        const time = response && response.si && response.si.time && response.si.time.current
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
                  <th>watching</th>
                </tr>
              </thead>
              <tbody>
                {pm2_ls_all ? pm2_ls_all.map(app => (
                  <tr key={app.name + app.pm_id} style={{ visibility: !app.counter && app.pm2_env.exec_mode === 'cluster_mode' && !state.apps[app.name] ? 'collapse' : 'visible', 
                    background: !app.counter && app.pm2_env.exec_mode === 'cluster_mode' ? 'lightgray' : ''}}>
                    <td> 
                      {
                        app.counter ? (
                          <button className={'btn btn-primary btn-xs pt-0 pb-0'} onClick={() => setUnsetState(app.name)}>{app.counter}x</button>
                        ) : ''
                      }
                    </td>
                    <td>{app.name}</td>
                    <td>{app.pm_id}</td>
                    <td>{app.pm2_env.exec_mode}</td>
                    <td>
                      <Badge color={app.pm2_env.status === 'online' ? 'green' : 'red'} >
                        {app.counter ? Tools.round((app.online/app.counter)*100, 0) + '%' : ''} {app.pm2_env.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td>{app.pm2_env.restart_time}</td>
                    <td>{Tools.getHumanTime((time - app.pm2_env.pm_uptime) / 1000)}</td>
                    <td>{Tools.round(app.monit.cpu, 1)}%</td>
                    <td>{Tools.getHumanSize(app.monit.memory)}</td>
                    <td>
                      <Badge color={app.pm2_env.watch ? 'green' : 'gray'} >
                        {(app.pm2_env.watch ? 'enabled' : 'disabled').toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                )) : ''}
              </tbody>
            </table>
          </div>
        )}}
    </Query>
  )
}

export default PM2
