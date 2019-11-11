import React from 'react'
import { observer } from 'mobx-react-lite'
import { AuthForm } from './components/Auth'
import { useStore } from './Store'
import Board from './components/Board'
import { Button, Navbar, Alignment } from '@blueprintjs/core'

const Logo = () => <img className='logo' src={require('./img/server-status.png')} alt='Logo' />

function App() {
  const { reload, addConnection, connections, ID, connection, edit, selectConnection, editConnection } = useStore()

  return (
    <div className="App">
      <Navbar className='nav'>
        <Navbar.Group align={Alignment.LEFT}>
          <Logo />
          <Navbar.Divider />
          {connections.map((con, i) => <>
            <Button minimal active={i === ID.connection} key={i} icon="unresolve" onClick={() => selectConnection(i)} >
              {con.name}
            </Button>
            <Button minimal icon="edit" onClick={() => editConnection(i)} />
            <Navbar.Divider />
          </>)}
          <Button minimal icon="add" onClick={addConnection} /> 
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button minimal icon="refresh" style={{ float: 'right' }} onClick={reload} />
        </Navbar.Group>
      </Navbar>
      { connection && <Board /> }
      { edit && <AuthForm connection={edit} /> }
    </div>
  )
}

export default observer(App)
