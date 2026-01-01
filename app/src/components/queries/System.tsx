import Query from '../Query'
import * as Tools from '../Tools'

type SystemResponse = {
  system: {
    hostname: string
    distro: string
    release: string
    kernel: string
  }
  cpu: {
    cores: number
    brand: string
    speed: string
  }
  time: {
    uptime: number
  }
}

const System = () => {
  return (
    <Query path="system" title="System">
      {response => {
        const responseTyped = response as SystemResponse
        const system = responseTyped.system || {}
        const cpu = responseTyped.cpu || {}
        const time = responseTyped.time || {}
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
              <td>{cpu.cores && `${cpu.cores}x `}{cpu.brand}{cpu.speed && ` @ ${cpu.speed}`}</td>
            </tr>
          </tbody>
        </table>
      }}
    </Query>
  )
}

export default System
