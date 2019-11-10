import React from 'react'
import Query from '../Query'
import { Tools } from '../Tools'
import { ProgressBar, ProgressMeter } from '../ProgressBar'

const Memory = () => {
  const query = '{ si: systeminformation { memory { total free used active available buffcache swaptotal swapused swapfree } } }'

  return (
    <Query query={query} title="Memory">
      {response => {
        let obj = {}
        if (response && response.si && response.si.memory)
          obj = response.si.memory

        const memory = [
          <ProgressBar key='mem-bar'>
            <ProgressMeter value={obj.active / obj.total} />
            <ProgressMeter value={obj.buffcache / obj.total} color="royalblue" />
            <ProgressMeter value={1 - obj.active / obj.total - obj.buffcache / obj.total} color='#dee2e6' />
          </ProgressBar>,
          <table key="mem" className="table table-striped table-sm">
            <tbody>
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
        if (obj.swaptotal) {

          memory.push(
            <ProgressBar key='swap-bar'>
              <ProgressMeter value={obj.swapused/obj.swaptotal} />
              <ProgressMeter value={1 - obj.swapused/obj.swaptotal} color='#dee2e6' />
            </ProgressBar>
          )
          
          memory.push(
            <table key="swap" className="table table-striped table-sm">
              <tbody>
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
          )
        }
        return memory
      }}
    </Query>
  )
}

export default Memory
