import React, { useState } from 'react'
import {
  ControlGroup, InputGroup, Dialog, Classes, Button, Callout,
} from '@blueprintjs/core'
import { observer } from 'mobx-react-lite'
import { useStore } from '../Store'

function useInput(initValue) {
  const [value, setValue] = useState(initValue)
  return [value, (event) => setValue(event.target.value)]
}

function useLoading(fun) {
  const [loading, setLoading] = useState(false)
  return [loading, async () => { setLoading(true); await fun(); setLoading(false) }]
}

export const AuthForm = observer(() => {
  const { user, login } = useStore()
  const [username, onUsernameChange] = useInput(user.name)
  const [pass, onPassChange] = useInput()
  const [error, setError] = useState('')
  const [loading, handleLogin] = useLoading(async () => setError(await login(username, pass)))

  return (
    <Dialog
      title="Authorization required"
      isOpen={!user.token}
      intent="primary"
      isCloseButtonShown={false}
    >
      <div className={Classes.DIALOG_BODY}>
        {error && (
          <p>
            <Callout intent="danger">
              {error}
            </Callout>
          </p>
        )}
        <ControlGroup vertical>
          <InputGroup placeholder="Username" value={username} onChange={onUsernameChange} autoFocus />
          <InputGroup type="password" placeholder="Password" value={pass} onChange={onPassChange} />
        </ControlGroup>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button loading={loading} onClick={handleLogin}>Login</Button>
        </div>
      </div>
    </Dialog>
  )
})
