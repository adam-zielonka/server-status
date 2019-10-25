import React from 'react'
import Query from '../Query'
import { ProgressBar, ProgressMeter } from '../ProgressBar'

const LoadAverage = () => {
  const query = 'loadAverage'

  return (
    <Query query={query} title="Load Average">
      {props => {
        const array = Array.isArray(props) ? props : [0,0,0]
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
