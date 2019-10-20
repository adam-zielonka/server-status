import React from 'react'
import { observer } from 'mobx-react-lite'
import { AuthForm } from './components/Auth'
import { DashBoard } from './components/Box'
import { useStore } from './Store'

function App() {
  const store = useStore()

  return (
    <div className="App">
      <DashBoard store={store} />
      <AuthForm />
    </div>
  )
}

export default observer(App)
