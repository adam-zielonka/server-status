/* eslint-disable react/no-array-index-key */
import React, { useState, useEffect } from 'react'
import {
  FormGroup, InputGroup, Dialog, Classes, Button, Callout,
} from '@blueprintjs/core'
import { observer } from 'mobx-react-lite'
import { useStore } from '../Store'

function useInput(initValue) {
  const [value, setValue] = useState(initValue)
  return [value, event => setValue(event.target.value)]
}

function useLoading(fun) {
  const [loading, setLoading] = useState(false)
  return [loading, async () => { setLoading(true); await fun(); setLoading(false) }]
}

export const AuthForm = observer(({ connection, errors }) => {
  const { login } = useStore()
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
      // className="auth-dialog"
      icon={<img className='auth-logo' src={require('../img/server-status.png')} alt='Logo' />}
    >
      <div className={Classes.DIALOG_BODY}>
        {errors.map((error, key) => <Callout key={key} intent="danger">{error.message}</Callout>)}
        <FormGroup vertical>
          <div style={{padding: '5px'}}></div>
          <InputGroup autoFocus={!user} disabled={loading} leftIcon="user" placeholder="Username" value={user} onChange={onUserChange} />
          <div style={{padding: '5px'}}></div>
          <InputGroup autoFocus={!!user} disabled={loading} leftIcon="key" type="password" placeholder="Password" value={pass} onChange={onPassChange} />
        </FormGroup>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button disabled={cannotLogin()} loading={loading} onClick={handleLogin}>Login</Button>
        </div>
      </div>
    </Dialog>
  )
})
