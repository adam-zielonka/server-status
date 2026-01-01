import Query from '../components/Query'
import { Badge } from '../components/Badge'

type ServiceHost = {
  name: string
  open: boolean
}

type Service = {
  port: number
  name: string
  hosts: ServiceHost[]
}

const Services = () => {
  return (
    <Query path="services" title="Services">
      {response => {
        const array = (Array.isArray(response) ? response : []) as Service[]
        const getBadgeColor = (open: boolean) => open ? 'green' : 'red'

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
