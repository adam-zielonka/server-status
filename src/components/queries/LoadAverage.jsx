import React from 'react'
import Query from '../Query'
import { Tools } from '../Tools'

const LoadAverage = () => {
  const query = 'loadAverage'

  return (
    <Query query={query} title="Load Average">
      {props => {
        const array = Array.isArray(props) ? props : [0,0,0]
        let time = [15, 5, 1]
        return (
          <div>
            <table className="table table-striped table-sm">
              <tbody>
                {array.map((avg, i) => (
                  <tr key={i}>
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
      }}
    </Query>
  )
}

export default LoadAverage
