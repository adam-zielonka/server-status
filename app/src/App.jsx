import React from 'react'
import { observer } from 'mobx-react-lite'
import { AuthForm } from './components/Auth'
import { useStore } from './Store'
import Board from './components/Board'
import { Button, Navbar, Alignment, Spinner } from '@blueprintjs/core'

const Logo = () => <img className='logo' src={require('./img/server-status.png')} alt='Logo' />

function App() {
  const { reload, errors, conf, logout } = useStore()

  if (errors.length) {
    return <div className="App">
      <AuthForm />
    </div>
  }

  if (!conf) {
    return <div className="spinner">
      <Spinner size='100' intent="primary" />
    </div>
  }

  return (
    <div className="App">
      <Navbar className='nav'>
        <Navbar.Group align={Alignment.LEFT}>
          <Logo />
          <Navbar.Divider />
          <div className="center-parent">
            <h3 className="bp3-heading center-child">ServerStatus</h3>
          </div>
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button minimal icon="log-out" style={{ float: 'right' }} onClick={logout} />
          <Button minimal icon="refresh" style={{ float: 'right' }} onClick={reload} />
        </Navbar.Group>
      </Navbar>
      <Board />
    </div>
  )
}

export default observer(App)
