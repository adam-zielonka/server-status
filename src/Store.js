import { createContext, useContext } from 'react'
import { observable, action } from 'mobx'
import api from './api'

export class Store {
  @observable user = {
    name: '',
    token: '',
  }

  @action login = async (username, password) => {
    const response = await api.login({ username, password })

    return 'Not implement yet'
  }
}

const store = createContext(new Store())

export function useStore() {
  return useContext(store)
}
