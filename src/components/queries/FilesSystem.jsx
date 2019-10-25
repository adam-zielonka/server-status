import React from 'react'
import Query from '../Query'
import { Tools } from '../Tools'

const FilesSystem = () => {
  const query = 'fs { fs type size used use mount }'

  return (
    <Query query={query} title="Files System">
      {props => {
        const array = Array.isArray(props) ? props : []
        return (
          <div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>mount</th>
                  <th className="w-100">use</th>
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
                    <td>
                      <div className="progress">
                        {Tools.getProgressBar(fs.use/100)}
                      </div>
                    </td>
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
