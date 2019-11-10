import React from 'react'
import Query from '../Query'
import { Tools } from '../Tools'

const Network = () => {
  const query = `{
    si: systeminformation {
      network {
        iface
        ifaceName
        ip4
        ip6
        mac
        internal
        virtual
        operstate
        type
        duplex
        mtu
        speed
        carrierChanges
        stats: networkStats {
          iface
          operstate
          rx_bytes
          rx_dropped
          rx_errors
          tx_bytes
          tx_dropped
          tx_errors
          rx_sec
          tx_sec
          ms
        }
      }
    }
  }`

  return (
    <Query query={query} title="Network">
      {response => {
        let array = []
        if(response && response.si && response.si.network) {
          array = Array.isArray(response.si.network) ? response.si.network : []
        }
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
                    <td>{net.stats ? Tools.getHumanSize(net.stats.rx_bytes) : ''}</td>
                    <td>{net.stats ? Tools.getHumanSize(net.stats.tx_bytes) : ''}</td>
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
