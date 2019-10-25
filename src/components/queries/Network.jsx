import React from 'react'
import Query from '../Query'
import { Tools } from '../Tools'

const Network = () => {
  const query = `network {
    iface
    ip4
    ip6
    mac
    internal
    networkStats { 
      iface
      operstate
      rx
      tx
      rx_sec
      tx_sec
      ms
    }
  }`

  return (
    <Query query={query} title="Network">
      {props => {
        const array = Array.isArray(props) ? props : []
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
                    <td>{net.ip4} {net.ip6}</td>
                    <td>{net.networkStats ? Tools.getHumanSize(net.networkStats.rx) : ''}</td>
                    <td>{net.networkStats ? Tools.getHumanSize(net.networkStats.tx) : ''}</td>
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
