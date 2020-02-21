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
  const query2 = '{ a2: caddy { vhosts { port name statusCode externalStatusCode } } }'

  return (
    <Query query={query} query2={query2} title="VirtualHosts">
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
                  {array.length && !array[0].externalStatusCode ? <>
                    <Th align='right'>code</Th>
                  </> : <>
                    <Th align='right'>in</Th>
                    <Th align='right'>out</Th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {array.map((host, i) => (
                  <tr key={i}>
                    <td>{host.port}</td>
                    <td>
                      <a href={'http://'+(host.name)}>{host.name}</a>
                    </td>
                    {!host.externalStatusCode ? <>
                      <Td align='right'>
                        <Badge color={getColorByCode(host.statusCode)}>{host.statusCode}</Badge>
                      </Td>
                    </> : <>
                      <Td align='right'>
                        <Badge color={getColorByCode(host.statusCode)}>{host.statusCode}</Badge>
                      </Td>
                      <Td align='right'>
                        <Badge color={getColorByCode(host.externalStatusCode)}>{host.externalStatusCode}</Badge>
                      </Td>
                    </>}
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
