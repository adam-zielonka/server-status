import { makeAutoObservable, reaction } from 'mobx'

export class Connection {
  user = ''
  token = ''

  constructor() {
    makeAutoObservable(this)

    const STORAGE_NAME = 'beta_connection'

    const stored = localStorage.getItem(STORAGE_NAME)
    if (stored) {
      try {
        const obj = JSON.parse(stored)
        this.user = obj.user || ''
        this.token = obj.token || ''
      } catch {
        localStorage.removeItem(STORAGE_NAME)
      }
    }

    reaction(() => this.toJSON, json => {
      localStorage.setItem(STORAGE_NAME, json)
    })
  }

  get toJSON() {
    return JSON.stringify({
      user: this.user,
      token: this.token,
    })
  }
}
