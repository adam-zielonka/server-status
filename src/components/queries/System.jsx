import React from 'react'
import Query from '../Query'

const System = () => {
  const query = 'system { platform distro release codename arch hostname kernel }'

  return (
    <Query query={query} title="System">
      {({ platform, distro, release, codename, arch, hostname, kernel }) => (
        <table>
          <tbody>
            <tr>
              <td>Hostname</td>
              <td>{hostname}</td>
            </tr>
            <tr>
              <td>OS</td>
              <td>
                {distro} {release}
              </td>
            </tr>
            <tr>
              <td>Kernel version</td>
              <td>{kernel}</td>
            </tr>
          </tbody>
        </table>
      )}
    </Query>
  )
}

export default System
