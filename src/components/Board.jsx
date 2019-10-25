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
      <System />
      <Memory />
      <LoadAverage />
      <PM2 />
      <FilesSystem />
      <Services />
      <Network />
      <VirtualHosts />
    </div>
  )
}

export default Board
