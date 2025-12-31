import { useState, useEffect } from 'react'
import {
  InputGroup, Dialog, Classes, Button, Callout,
} from '@blueprintjs/core'
import { observer } from 'mobx-react-lite'
import { useStore } from '../Store'
import logo from '../img/server-status.png'

function useInput(initValue = '') {
  const [value, setValue] = useState(initValue)
  return [value, event => setValue(event.target.value)]
}

function useLoading(fun) {
  const [loading, setLoading] = useState(false)
  return [loading, async () => { setLoading(true); await fun(); setLoading(false) }]
}

export const AuthForm = observer(() => {
  const { login, connection, errors } = useStore()
  const [user, onUserChange] = useInput(connection.user)
  const [pass, onPassChange] = useInput()
  const [loading, handleLogin] = useLoading(async () => login({ user, pass }))

  const cannotLogin = () => !user || !pass

  useEffect(() => {
    const onDocumentKeyDownHandler = (e) => {
      if (!cannotLogin() && !loading && 'Enter' === e.key) {
        handleLogin()
      }
    }
    document.addEventListener('keydown', onDocumentKeyDownHandler)
    return () => document.removeEventListener('keydown', onDocumentKeyDownHandler)
  })

  return (
    <Dialog
      title="ServerStatus"
      isOpen={true}
      intent="primary"
      isCloseButtonShown={false}
      backdropClassName="backdrop"
      icon={<img className='auth-logo' src={logo} alt='Logo' />}
    >
      <div className={Classes.DIALOG_BODY}>
        {errors.map((error, key) => <Callout key={key} intent="danger">{error}</Callout>)}
        <div style={{padding: '5px'}} />
        <InputGroup autoFocus={!user} disabled={loading} leftIcon="user" placeholder="Username" value={user} onChange={onUserChange} />
        <div style={{padding: '5px'}} />
        <InputGroup autoFocus={!!user} disabled={loading} leftIcon="key" type="password" placeholder="Password" value={pass} onChange={onPassChange} />
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <Button disabled={cannotLogin()} style={{width:'100%'}} loading={loading} onClick={handleLogin}>Login</Button>
      </div>
    </Dialog>
  )
})
