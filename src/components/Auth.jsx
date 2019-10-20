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

export const AuthForm = observer(() => {
  const { user, login } = useStore()
  const [username, onUsernameChange] = useInput(user.name)
  const [url, onUrlChange] = useInput(user.url)
  const [pass, onPassChange] = useInput()
  const [loading, handleLogin] = useLoading(async () => login(url, username, pass))

  const cannotLogin = () => !url || !username || !pass

  return (
    <Dialog
      title="Authorization required"
      isOpen={!user.token}
      intent="primary"
      isCloseButtonShown={false}
    >
      <div className={Classes.DIALOG_BODY}>
        {user.errors.map((error, key) => <Callout key={key} intent="danger">{error.message}</Callout>)}
        <ControlGroup vertical>
          <InputGroup leftIcon="globe-network" placeholder="API URL" value={url} onChange={onUrlChange} autoFocus />
          <InputGroup leftIcon="user" placeholder="Username" value={username} onChange={onUsernameChange} autoFocus />
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
