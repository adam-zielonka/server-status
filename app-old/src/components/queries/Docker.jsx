import React from 'react'
import Query from '../Query'
import * as Tools from '../Tools'
import { Badge } from '../Badge'

const Docker = () => {
  const query = `{ 
    si: systeminformation {
      time {
        current
      }
      docker {
        name
        state
        mem_usage
        mem_limit
        mem_percent
        cpu_percent
        created
        started
        finished
        netIO {
          rx
          wx
        }
        blockIO {
          r
          w
        }
        pids
      }
    }
  }`

  return (
    <Query query={query} title="Docker">
      {response => {
        let array = []
        if (response && response.si && response.si.docker)
          array = Array.isArray(response.si.docker) ? response.si.docker : []

        const time = response && response.si && response.si.time && response.si.time.current
        const dockerTime = ({ state, created, started, finished }) => {
          if(state === 'created') return created
          if(state === 'running') return started
          return finished
        }
        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>name</th>
                  <th>pids</th>
                  <th>state</th>
                  <th>uptime</th>
                  <th>cpu</th>
                  <th>mem</th>
                  <th>mem usage / limit</th>
                  <th>net I/O</th>
                  <th>block I/O</th>
                </tr>
              </thead>
              <tbody>
                {array ? array.map(app => (
                  <tr key={app.name} >
                    <td>{app.name}</td>
                    <td>{app.pids}</td>
                    <td>
                      <Badge color={app.state === 'created' ? 'gray' : app.state === 'running' ? 'green' : 'red'} >
                        {app.state.toUpperCase()}
                      </Badge>
                    </td>
                    <td>{Tools.getHumanTime((time - dockerTime(app)*1000) / 1000)}</td>
                    <td>{Tools.round(app.cpu_percent, 2)}%</td>
                    <td>{Tools.round(app.mem_percent, 2)}%</td>
                    <td>{Tools.getHumanSize(app.mem_usage)}/{Tools.getHumanSize(app.mem_limit)}</td>
                    <td>{Tools.getHumanSize(app.netIO.rx)}/{Tools.getHumanSize(app.netIO.wx)}</td>
                    <td>{Tools.getHumanSize(app.blockIO.r)}/{Tools.getHumanSize(app.blockIO.w)}</td>
                  </tr>
                )) : ''}
              </tbody>
            </table>
          </div>
        )}}
    </Query>
  )
}

export default Docker
