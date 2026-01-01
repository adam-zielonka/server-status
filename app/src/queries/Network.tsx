import Query from '../components/Query'
import * as Tools from '../utils/Tools'

const Network = () => {
  return (
    <Query path="net" title="Network">
      {response => {
        const array = Array.isArray(response) ? response : []
        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>interface</th>
                  <th>IP</th>
                  <th>receive</th>
                  <th>transmit</th>
                </tr>
              </thead>
              <tbody>
                {array.map(net => (
                  <tr key={net.iface}>
                    <td>{net.iface}</td>
                    <td style={{whiteSpace: 'break-spaces'}}>{net.addresses.join(' ')}</td>
                    <td>{Tools.getHumanSize(net.rx_bytes)}</td>
                    <td>{Tools.getHumanSize(net.tx_bytes)}</td>
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

export default Network
