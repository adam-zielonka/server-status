import React from 'react'
import Query from '../Query'
import * as Tools from '../Tools'

const System = () => {
  const query = `{
    si: systeminformation {
      system {
        platform
        distro
        release
        codename
        kernel
        arch
        hostname
      }
      cpu {
        manufacturer
        brand
        speed
        cores
      }
      time {
        current
        uptime
        timezone
        timezoneName
      }
    }
  }`

  return (
    <Query query={query} title="System">
      {response => {
        const system = (response.si && response.si.system) || {}
        const cpu = (response.si && response.si.cpu) || {}
        const time = (response.si && response.si.time) || {}
        return <table>
          <tbody>
            <tr>
              <td>Hostname</td>
              <td>{system.hostname}</td>
            </tr>
            <tr>
              <td>OS</td>
              <td>
                {system.distro} {system.release}
              </td>
            </tr>
            <tr>
              <td>Kernel version</td>
              <td>{system.kernel}</td>
            </tr>
            <tr>
              <td>Uptime</td>
              <td>{time && Tools.getHumanTime(time.uptime)}</td>
            </tr>
            <tr>
              <td>CPU</td>
              <td>{cpu.cores}{cpu.cores && 'x'} {cpu.manufacturer} {cpu.brand} {cpu.speed && '@'} {cpu.speed}</td>
            </tr>
          </tbody>
        </table>
      }}
    </Query>
  )
}

export default System
