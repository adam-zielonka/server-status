import React from 'react'
import Query from '../Query'
import * as Tools from '../Tools'
import { ProgressBar, ProgressMeter } from '../ProgressBar'

const FilesSystem = () => {
  const query = '{ si: systeminformation { fs { fs type size used use mount } } }'

  return (
    <Query query={query} title="Files System">
      {response => {
        let array = []
        if (response && response.si && response.si.fs)
          array = Array.isArray(response.si.fs) ? response.si.fs : []
        const [size, used] = array.reduce(([size, used], c) => [size + c.size, used + c.used], [0, 0])
        return (
          <div>
            <ProgressBar>
              <ProgressMeter value={used/size} />
              <ProgressMeter value={1 - used/size} color='#dee2e6' />
            </ProgressBar>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>mount</th>
                  <th>type</th>
                  <th>size</th>
                  <th>used</th>
                  <th>free</th>
                </tr>
              </thead>
              <tbody>
                {array.map(fs => (
                  <tr key={fs.mount}>
                    <td>{fs.mount}</td>
                    <td>{fs.type}</td>
                    <td>{Tools.getHumanSize(fs.size)}</td>
                    <td>{Tools.getHumanSize(fs.used)}</td>
                    <td>{Tools.getHumanSize(fs.size-fs.used)}</td>
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

export default FilesSystem
