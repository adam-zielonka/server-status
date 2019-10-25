import React from 'react'
import { observer } from 'mobx-react-lite'
import { AuthForm } from './components/Auth'
import { useStore } from './Store'
import Board from './components/Board'
import { Button } from '@blueprintjs/core'

function App() {
  const { reload } = useStore()

  return (
    <div className="App">
      <nav className="nav">
        <a href="/">Server Status</a>
        <Button minimal icon="refresh" style={{ float: 'right' }} onClick={reload} />
        <br/><br/>
      </nav>
      <Board />
      <AuthForm />
    </div>
  )
}

export default observer(App)
