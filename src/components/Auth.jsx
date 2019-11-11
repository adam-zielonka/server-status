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

export const AuthForm = observer(({ connection }) => {
  const { login, ID, deleteConnection } = useStore()
  const [name, onNameChange] = useInput(connection.name)
  const [user, onUserChange] = useInput(connection.user)
  const [url, onUrlChange] = useInput(connection.url)
  const [pass, onPassChange] = useInput()
  const [loading, handleLogin] = useLoading(async () => login({ connection, url, user, pass, name }))

  const cannotLogin = () => !url || !user || !pass

  return (
    <Dialog
      title="Connection"
      isOpen={!!connection}
      intent="primary"
      isCloseButtonShown={false}
    >
      <div className={Classes.DIALOG_BODY}>
        {connection.errors.map((error, key) => <Callout key={key} intent="danger">{error.message}</Callout>)}
        <ControlGroup vertical>
          <InputGroup leftIcon="unresolve" placeholder="Connection name" value={name} onChange={onNameChange} autoFocus />
          <InputGroup leftIcon="globe-network" placeholder="API URL" value={url} onChange={onUrlChange} />
          <InputGroup leftIcon="user" placeholder="Username" value={user} onChange={onUserChange} />
          <InputGroup leftIcon="key" type="password" placeholder="Password" value={pass} onChange={onPassChange} />
        </ControlGroup>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button icon='trash' onClick={deleteConnection} />
          <Button onClick={() => ID.edit = null}>Exit</Button>
          <Button disabled={cannotLogin()} loading={loading} onClick={handleLogin}>Login</Button>
        </div>
      </div>
    </Dialog>
  )
})
