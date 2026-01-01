import Query from '../components/Query'
import { Badge } from '../components/Badge'
import type { CSSProperties } from 'react'

type Element = {
  align: CSSProperties['textAlign']
  children: React.ReactNode
}

const Th = ({ align, children }: Element) => {
  return <th style={{ textAlign: align }}>{children}</th>
}

const Td = ({ align, children }: Element) => {
  return <td style={{ textAlign: align }}>{children}</td>
}

function getColorByCode(code: number) { 
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
  return (
    <Query path="vhosts" title="VirtualHosts">
      {response => {
        const array = Array.isArray(response) ? response : []
        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <Th align="left">port</Th>
                  <Th align="left">name</Th>
                  {array.length && !array[0].externalStatusCode ? <>
                    <Th align="right">code</Th>
                  </> : <>
                    <Th align="right">in</Th>
                    <Th align="right">out</Th>
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
                      <Td align="right">
                        <Badge color={getColorByCode(host.statusCode)}>{host.statusCode}</Badge>
                      </Td>
                    </> : <>
                      <Td align="right">
                        <Badge color={getColorByCode(host.statusCode)}>{host.statusCode}</Badge>
                      </Td>
                      <Td align="right">
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
