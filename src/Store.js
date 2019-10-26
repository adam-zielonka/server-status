/* eslint-disable object-curly-newline */
import { createContext, useContext } from 'react'
import { observable, action, computed } from 'mobx'
import api from './api'
import autoSave from './autoSave'

export class Connection {
  @observable name = ''
  @observable user = ''
  @observable token = ''
  @observable errors = []
  @observable url = ''
}

export class Store {
  @observable date = new Date()
  @observable ID = {
    edit: null,
    connection: null,
  }
  @observable connections = []

  constructor() { autoSave(this) }

  @computed get connection() {
    return this.ID.connection !== null && this.connections[this.ID.connection]
  }

  @computed get edit() {
    return this.ID.edit !== null && this.connections[this.ID.edit]
  }

  @action reload = () => this.date = new Date()

  @action addConnection = () => {
    this.connections.push(new Connection())
    this.ID.edit = this.connections.length - 1
  }

  @action editConnection = id => this.ID.edit = id

  @action selectConnection = id => {
    this.ID.connection = id
    this.reload()
  }

  @action deleteConnection = () => {
    this.connections = this.connections.filter((_, i) => i !== this.ID.edit)
    this.ID.edit = null
    this.ID.connection = null
  }

  @action login = async ({ connection, url, user, pass, name }) => {
    const { data, errors } = await api.login({ url, username: user, password: pass })

    if (errors) connection.errors = errors
    else if (data && data.login) {
      connection.token = data.login.token
      connection.user = user
      connection.name = name
      connection.url = url
      connection.errors = []
      this.ID.edit = null
    }
  }

  getData = async ({ query, variables }) => {
    const { url, token } = this.connections[this.ID.connection]
    return api.getData({ url, token, query, variables })
  }
}

const store = createContext(new Store())

export function useStore() {
  return useContext(store)
}
