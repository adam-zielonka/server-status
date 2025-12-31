import Query from '../Query'
import { ProgressBar, ProgressMeter } from '../ProgressBar'

const LoadAverage = () => {
  return (
    <Query path="load-average" title="Load Average">
      {response => {
        if (!Array.isArray(response) || response.length !== 3) {
          return null
        }
        const array = response
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
