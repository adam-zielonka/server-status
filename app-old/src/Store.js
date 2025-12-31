/* eslint-disable object-curly-newline */
import { createContext, useContext } from 'react'
import { observable, action, computed } from 'mobx'
import api from './api'
import autoSave from './autoSave'
import YAML from 'yaml'

const url = process.env.REACT_APP_API_URL || '/api/'

const getDefaultLayout = () => YAML.parse(`
- board-3: 
  - div:
    - system
    - loadAverage
  - div:
    - memory
    - fileSystem
- div:
  - pm2
  - docker
  - board-2:
    - div:
      - network
      - services
    - div:
      - virtualHosts
`)

export class Connection {
  @observable user = ''
  @observable token = ''
}

export class Store {
  @observable date = new Date()
  @observable connection = new Connection()
  @observable errors = []
  @observable conf = null

  constructor() { 
    autoSave(this) 
    this.loadConf()
  }

  @computed get layout() {
    return (this.conf && this.conf.layout && JSON.parse(this.conf.layout)) || getDefaultLayout()
  }

  @action loadConf = async () => {
    const query = `{
      serverstatus {
        plugins {
          name
        }
        layout
      }
    }`

    const { data, errors } = await this.getData({ query })
    this.conf = data && data.serverstatus
    this.errors = errors || []
  }

  @action reload = () => this.date = new Date()

  @action login = async ({ user, pass }) => {
    const { data, errors } = await api.login({ url, username: user, password: pass })

    if (errors) this.errors = errors
    else if (data && data.login) {
      this.connection.token = data.login.token
      this.connection.user = user
      await this.loadConf()
    }
  }

  @action logout = () => {
    this.connection.token = ''
    this.conf = null
    this.errors = [{ message: 'Logout' }]
  }

  getData = async ({ query, variables }) => {
    const { token } = this.connection
    return api.getData({ url, token, query, variables })
  }
}

const store = createContext(new Store())

export function useStore() {
  return useContext(store)
}
