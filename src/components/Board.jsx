import React from 'react'
import System from './queries/System'
import Memory from './queries/Memory'
import LoadAverage from './queries/LoadAverage'
import PM2 from './queries/PM2'
import FilesSystem from './queries/FilesSystem'
import Services from './queries/Services'
import Network from './queries/Network'
import VirtualHosts from './queries/VirtualHosts'

function Board() {

  return (
    <div className="board">
      <div>
        <System />
        <LoadAverage />
        <Memory />
      </div>
      <div>
        <PM2 />
        <div className="board-2">
          <div>
            <FilesSystem />
            <Services />
          </div>
          <div>
            <Network />
            <VirtualHosts />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Board
