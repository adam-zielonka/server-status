import React from 'react'
import Query from '../Query'
import { Tools } from '../Tools'

const Services = () => {
  const query = `services {
    name
    port
    link
    hosts {
      name
      port
      open
    }
  }`

  return (
    <Query query={query} title="Services">
      {props => {
        const array = Array.isArray(props) ? props : []
        // eslint-disable-next-line no-case-declarations
        const getBadgeColor = open => (open ? {
          background: 'green',
          color: 'white',
        } : {
          background: 'red',
          color: 'white',
        })

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
                      {service.hosts.map(host =>
                        <>
                          <span style={getBadgeColor(host.open)} className={'ml-1 badge badge-' + (host.open ? 'success' : 'danger')}>
                      &nbsp;{host.name}&nbsp;
                          </span>
                      &nbsp; &nbsp;
                        </>
                      )}
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
