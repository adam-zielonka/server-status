import React from 'react'
import { observer } from 'mobx-react-lite'
import { AuthForm } from './components/Auth'
import { useStore } from './Store'
import Board from './components/Board'
import { Button, Navbar, Alignment } from '@blueprintjs/core'

const Logo = () => <img className='logo' src={require('./img/server-status.png')} alt='Logo' />

function App() {
  const { reload, connection, errors, conf } = useStore()

  if (errors.length) {
    return <div className="App">
      <AuthForm connection={connection} errors={errors} />
    </div>
  }

  if (!conf) {
    return <div className="App">
      Loading...
    </div>
  }

  return (
    <div className="App">
      <Navbar className='nav'>
        <Navbar.Group align={Alignment.LEFT}>
          <Logo />
          <Navbar.Divider />
          <h3 className="bp3-heading" style={{ paddingTop: '5px' }}>ServerStatus</h3>
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button minimal icon="refresh" style={{ float: 'right' }} onClick={reload} />
        </Navbar.Group>
      </Navbar>
      <Board />
    </div>
  )
}

export default observer(App)
