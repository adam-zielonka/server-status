import React from 'react'
import Query from '../Query'
import { Badge } from '../Badge'

const Th = ({ align, children }) => {
  return <th style={{ textAlign: align }}>{children}</th>
}

const Td = ({ align, children }) => {
  return <td style={{ textAlign: align }}>{children}</td>
}

function getColorByCode(code) { 
  switch (Math.floor(code/100)) {
  case 1: return 'blue'
  case 2: return 'green'
  case 3: return 'orange'
  case 4: return 'black'
  case 5: return 'red'
  default: return 'gray'
  }
}

const VirtualHosts = () => {
  const query = '{ a2: apache2 { vhosts { port name statusCode } } }'

  return (
    <Query query={query} title="VirtualHosts">
      {response => {
        let array = []
        if(response && response.a2 && response.a2.vhosts)
          array = Array.isArray(response.a2.vhosts) ? response.a2.vhosts : []
        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <Th align='left'>port</Th>
                  <Th align='left'>name</Th>
                  <Th align='right'>code</Th>
                </tr>
              </thead>
              <tbody>
                {array.map((host, i) => (
                  <tr key={i}>
                    <td>{host.port}</td>
                    <td>
                      <a href={'http://'+(host.name)}>{host.name}</a>
                    </td>
                    <Td align='right'>
                      <Badge color={getColorByCode(host.statusCode)}>{host.statusCode}</Badge>
                    </Td>
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
