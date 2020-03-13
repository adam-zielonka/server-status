/* eslint-disable object-curly-newline */
import { createContext, useContext } from 'react'
import { observable, action } from 'mobx'
import api from './api'
import autoSave from './autoSave'

export class Connection {
  @observable user = ''
  @observable token = ''
  @observable errors = []
  @observable url = '/api/'
  @observable conf = null
}

export class Store {
  @observable date = new Date()
  @observable connection = new Connection()

  constructor() { 
    autoSave(this) 
    this.loadConf()
  }

  @action loadConf = async () => {
    const query = `{
      serverstatus {
        plugins {
          name
        }
      }
    }`

    const { data, errors } = await this.getData({ query })
    this.connection.conf = data && data.serverstatus
    this.connection.errors = errors || []
  }

  @action reload = () => this.date = new Date()

  @action login = async ({ user, pass }) => {
    const connection = this.connection
    const { data, errors } = await api.login({ url: connection.url, username: user, password: pass })

    if (errors) connection.errors = errors
    else if (data && data.login) {
      connection.token = data.login.token
      connection.user = user
      await this.loadConf()
    }
  }

  getData = async ({ query, variables }) => {
    const { url, token } = this.connection
    return api.getData({ url, token, query, variables })
  }
}

const store = createContext(new Store())

export function useStore() {
  return useContext(store)
}
