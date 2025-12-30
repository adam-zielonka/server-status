import System from './queries/System'
import Memory from './queries/Memory'
import LoadAverage from './queries/LoadAverage'
import FilesSystem from './queries/FilesSystem'
import Services from './queries/Services'
import Network from './queries/Network'
import VirtualHosts from './queries/VirtualHosts'
import { observer } from 'mobx-react-lite'
import { useStore } from '../Store'

function getBox(name) {
  switch (name) {
  case 'system': return <System />
  case 'loadAverage': return <LoadAverage />
  case 'memory': return <Memory />
  case 'fileSystem': return <FilesSystem />
  case 'network': return <Network />
  case 'services': return <Services />
  case 'virtualHosts': return <VirtualHosts />
  default: return ''
  }
}

function objectDecoder(object) {
  const list = []
  for (const key in object) {
    // eslint-disable-next-line no-prototype-builtins
    if (object.hasOwnProperty(key)) {
      const element = object[key]
      list.push(<div className={key}>{whatIsIt(element)}</div>)
    }
  }
  return list
}

function whatIsIt(element) {
  switch (true) {
  case Array.isArray(element): return element.map(e => whatIsIt(e))
  case typeof element === 'object': return objectDecoder(element)
  case typeof element === 'string': return getBox(element)
  default: return ''
  }
}

function Board() {
  const { layout } = useStore()

  return (
    <div className="board">
      {whatIsIt(layout)}
    </div>
  )
}

export default observer(Board)
