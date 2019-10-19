import { createContext, useContext } from 'react'
import { observable } from 'mobx'

export class Store {
  @observable user = {
    name: false,
    token: false,
  }
}

const store = createContext(new Store())

export function useStore() {
  return useContext(store)
}
