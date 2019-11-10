import React from 'react'
import Query from '../Query'
import { ProgressBar, ProgressMeter } from '../ProgressBar'

const LoadAverage = () => {
  const query = '{ si: systeminformation { loadAverage } }'

  return (
    <Query query={query} title="Load Average">
      {response => {
        let array = [0,0,0]
        if (response && response.si && response.si.loadAverage)
          array = Array.isArray(response.si.loadAverage) ? response.si.loadAverage : [0,0,0]
        let time = [15, 5, 1]
        return (
          <div>
            <table>
              <tbody>
                {array.map((avg, i) => (
                  <tr key={i}>
                    <td>{time.pop()}&nbsp;min</td>
                    <td width="99%">
                      <ProgressBar>
                        <ProgressMeter value={avg} />
                      </ProgressBar>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }}
    </Query>
  )
}

export default LoadAverage
