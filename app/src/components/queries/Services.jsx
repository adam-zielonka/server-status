import React from 'react'
import Query from '../Query'
import { Badge } from '../Badge'

const Services = () => {
  const query = `{ 
    services {
      name
      port
      link
      hosts {
        name
        port
        open
      }
    }
  }`

  return (
    <Query query={query} title="Services">
      {response => {
        let array = []
        if(response && response.services)
          array = Array.isArray(response.services) ? response.services : []
        const getBadgeColor = open => open ? 'green' : 'red'

        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>port</th>
                  <th>host</th>
                  <th>name</th>
                </tr>
              </thead>
              <tbody>
                {array.map((service, i) => (
                  <tr key={i}>
                    <td>{service.port}</td>
                    <td>
                      {service.hosts.map(host => <Badge key={host.name} color={getBadgeColor(host.open)}>{host.name}</Badge> )}
                    </td>
                    <td>{service.name}</td>
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

export default Services
