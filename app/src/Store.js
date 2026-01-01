import { createContext, useContext } from 'react'
import { makeAutoObservable, runInAction } from 'mobx'
import api, { setAuthToken } from './api'
import autoSave from './autoSave'

export class Connection {
  user = ''
  token = ''

  constructor() {
    makeAutoObservable(this)
  }
}

export class Store {
  date = new Date()
  connection = new Connection()
  errors = []
  conf = null

  constructor() { 
    makeAutoObservable(this)
    autoSave(this) 
    setTimeout(() => this.loadConf())
  }

  loadConf = async () => {
    const { errors } = await api.fetch('ok', this.connection.token)
    runInAction(() => {
      this.errors = errors || []
      this.conf = 'loaded'
    })
  }

  reload = () => this.date = new Date()

  login = async ({ user, pass }) => {
    const { data, errors } = await api.login({ username: user, password: pass })

    if (errors) this.errors = errors
    else if (data && data.token) {
      runInAction(() => {
        this.connection.token = data.token
        this.connection.user = user
        setAuthToken(data.token)
      })
      await this.loadConf()
    }
  }

  logout = () => {
    this.connection.token = ''
    this.conf = null
    this.errors = [ 'Logout' ]
    setAuthToken('')
  }
}
const _store = new Store()
const store = createContext(_store)

// Only expose store in development mode
if (import.meta.env.DEV) {
  window.store = _store
}

export function useStore() {
  return useContext(store)
}
