import React from 'react'
import { observer } from 'mobx-react-lite'
import { AuthForm } from './components/Auth'
import { useStore } from './Store'
import Board from './components/Board'
import { Button, ButtonGroup } from '@blueprintjs/core'

function App() {
  const { reload, addConnection, connections, ID, connection, edit, selectConnection, editConnection } = useStore()

  return (
    <div className="App">
      <nav className="nav">
        <ButtonGroup>
          {connections.map((con, i) => <Button active={i === ID.connection} key={i} icon="unresolve" onClick={() => selectConnection(i)} >
            {con.name} <Button icon="edit" onClick={() => editConnection(i)} />
          </Button>)}
          <Button icon="add" onClick={addConnection} />
        </ButtonGroup> 
        <Button minimal icon="refresh" style={{ float: 'right' }} onClick={reload} />
        <br/><br/>
      </nav>
      { connection && <Board /> }
      { edit && <AuthForm connection={edit} /> }
    </div>
  )
}

export default observer(App)
