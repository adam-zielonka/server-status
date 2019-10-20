/* eslint-disable object-curly-newline */
import { createContext, useContext } from 'react'
import { observable, action } from 'mobx'
import api from './api'
import autoSave from './autoSave'

export class Store {
  @observable user = {
    name: '',
    token: '',
    errors: [],
    url: '',
  }

  constructor() { autoSave(this) }

  @action login = async (url, username, password) => {
    const { data, errors } = await api.login({ url, username, password })

    if (errors) this.user.errors = errors
    else if (data && data.login) {
      this.user.token = data.login.token
      this.user.name = data.login.user.name
      this.user.url = url
    }
  }

  getData = async ({ query, variables }) => {
    const { url, token } = this.user
    return api.getData({ url, token, query, variables })
  }
}

const store = createContext(new Store())

export function useStore() {
  return useContext(store)
}
