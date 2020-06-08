import React from 'react'
import System from './queries/System'
import Memory from './queries/Memory'
import LoadAverage from './queries/LoadAverage'
import PM2 from './queries/PM2'
import FilesSystem from './queries/FilesSystem'
import Services from './queries/Services'
import Network from './queries/Network'
import VirtualHosts from './queries/VirtualHosts'
import Docker from './queries/Docker'

function Board() {

  return (
    <div className="board">
      <div>
        <div className="board-3">
          <div>
            <System />
            <LoadAverage />
          </div>
          <div>
            <Memory />
            <FilesSystem />
          </div>
        </div>
      </div>
      <div>
        <PM2 />
        <Docker />
        <div className="board-2">
          <div>
            <Network />
            <Services />
          </div>
          <div>
            <VirtualHosts />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Board
