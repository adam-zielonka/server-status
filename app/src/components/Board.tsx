import System from './queries/System'
import Memory from './queries/Memory'
import LoadAverage from './queries/LoadAverage'
import FilesSystem from './queries/FilesSystem'
import Services from './queries/Services'
import Network from './queries/Network'
import VirtualHosts from './queries/VirtualHosts'

function Board() {
  return (
    <div className="board">
      <div className="board-3">
        <div>
          <System />
          <LoadAverage />
        </div>
        <div>
          <Memory />
        </div>
      </div>
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
  )
}

export default Board
