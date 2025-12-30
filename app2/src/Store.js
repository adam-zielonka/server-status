/* eslint-disable object-curly-newline */
import { createContext, useContext } from 'react'
import { makeAutoObservable, runInAction } from 'mobx'
import api from './api'
import autoSave from './autoSave'

const url = import.meta.env.VITE_API_URL || '/api/'

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
      this.conf = "loaded"
    })
  }

  reload = () => this.date = new Date()

  login = async ({ user, pass }) => {
    const { data, errors } = await api.login({ url, username: user, password: pass })

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

  getData = async ({ query, variables }) => {
    const { token } = this.connection
    return api.getData({ url, token, query, variables })
  }
}
const _store = new Store()
const store = createContext(_store)
window.store = _store

export function useStore() {
  return useContext(store)
}
