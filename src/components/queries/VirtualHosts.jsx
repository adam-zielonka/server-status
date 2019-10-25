import React from 'react'
import Query from '../Query'
import { Tools } from '../Tools'

const VirtualHosts = () => {
  const query = 'vhosts { port name statusCode }'

  return (
    <Query query={query} title="VirtualHosts">
      {props => {
        const array = Array.isArray(props) ? props : []
        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>port</th>
                  <th>name</th>
                  <th>status code</th>
                </tr>
              </thead>
              <tbody>
                {array.map((host, i) => (
                  <tr key={i}>
                    <td>{host.port}</td>
                    <td>
                      <a href={"http://"+(host.name)}>{host.name}</a>
                    </td>
                    <td>
                      <span className={"badge badge-" + (Tools.getColorByCode(host.statusCode))}>
                        {host.statusCode}
                      </span>
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

export default VirtualHosts
