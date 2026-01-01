import { createContext, useContext } from 'react'
import { makeAutoObservable, runInAction } from 'mobx'
import api from './api.ts'
import autoSave from './autoSave.ts'

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
  errors: string[] = []
  conf: null | "loaded" = null

  constructor() { 
    makeAutoObservable(this)
    autoSave(this) 
    setTimeout(() => this.loadConf())
  }

  loadConf = async () => {
    const { errors } = await api.fetch('ok')
    runInAction(() => {
      this.errors = errors || []
      this.conf = 'loaded'
    })
  }

  reload = () => this.date = new Date()

  login = async (user: string, pass: string) => {
    const { data, errors } = await api.login(user, pass)

    if (errors) this.errors = errors
    else if (data && data.token) {
      runInAction(() => {
        this.connection.token = data.token
        this.connection.user = user
      })
      await this.loadConf()
    }
  }

  logout = () => {
    this.connection.token = ''
    this.conf = null
    this.errors = [ 'Logout' ]
  }
}
const _store = new Store()
const store = createContext(_store)

declare global { interface Window { store: Store} }
window.store = _store

export function useStore() {
  return useContext(store)
}
