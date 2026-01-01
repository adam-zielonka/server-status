import { observer } from 'mobx-react-lite'
import { AuthForm } from './components/Auth'
import { store } from './store/Store'
import Board from './components/Board'
import { Button, Navbar, Alignment, Spinner } from '@blueprintjs/core'
import logo from '/server-status.png'

const Logo = () => <img className="logo" src={logo} alt="Logo" />

function App() {
  const { reload, errors, conf, logout } = store

  if (errors.length) {
    return <div className="App">
      <AuthForm />
    </div>
  }

  if (!conf) {
    return <div className="spinner">
      <Spinner size={100} intent="primary" />
    </div>
  }

  return (
    <div className="App">
      <Navbar className="nav">
        <Navbar.Group align={Alignment.LEFT}>
          <Logo />
          <Navbar.Divider />
          <div className="center-parent">
            <h3 className="bp6-heading center-child">ServerStatus</h3>
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
