/* eslint-disable react/no-array-index-key */
import React, { useState } from 'react'
import {
  ControlGroup, InputGroup, Dialog, Classes, Button, Callout,
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

  return (
    <Dialog
      title="Connection"
      isOpen={true}
      intent="primary"
      isCloseButtonShown={false}
      icon="globe-network"
    >
      <div className={Classes.DIALOG_BODY}>
        {errors.map((error, key) => <Callout key={key} intent="danger">{error.message}</Callout>)}
        <ControlGroup vertical>
          <InputGroup leftIcon="user" placeholder="Username" value={user} onChange={onUserChange} />
          <InputGroup leftIcon="key" type="password" placeholder="Password" value={pass} onChange={onPassChange} />
        </ControlGroup>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button disabled={cannotLogin()} loading={loading} onClick={handleLogin}>Login</Button>
        </div>
      </div>
    </Dialog>
  )
})
