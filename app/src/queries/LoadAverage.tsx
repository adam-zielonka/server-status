import Query from '../components/Query'
import { ProgressBar, ProgressMeter } from '../components/ProgressBar'

const LoadAverage = () => {
  return (
    <Query path="load-average" title="Load Average">
      {response => {
        const array = Array.isArray(response) ? response : [0,0,0]
        const time = [15, 5, 1]
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
