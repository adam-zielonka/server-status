import React from 'react'
import Query from '../Query'
import { Tools } from '../Tools'
import { ProgressBar, ProgressMeter } from '../ProgressBar'
import { Colors } from '@blueprintjs/core'

const Memory = () => {
  const query = 'memory { total free used active available buffcache swaptotal swapused swapfree }'

  return (
    <Query query={query} title="Memory">
      {obj => {
        const memory = [
          <table key="mem" className="table table-striped table-sm">
            <tbody>
              <tr>
                <td colSpan="4">
                  <div className="progress">
                    <ProgressBar>
                      <ProgressMeter value={obj.active / obj.total + obj.buffcache / obj.total} color={Colors.BLUE3} />
                      <ProgressMeter value={obj.active / obj.total} />
                    </ProgressBar>
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
          <table key="swap" className="table table-striped table-sm">
            <tbody>
              <tr>
                <td colSpan="4">
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
      }}
    </Query>
  )
}

export default Memory
