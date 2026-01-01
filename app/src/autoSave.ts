import { autorun } from 'mobx'
import type { Store } from './Store'

const STORAGE_NAME = 'beta_connection'

export default function (store: Store) {
  let firstRun = true

  autorun(() => {
    if (firstRun) {
      const connection = JSON.parse(localStorage.getItem(STORAGE_NAME) || '{}')
      if (connection) store.connection = connection
      firstRun = false
    }

    localStorage.setItem(STORAGE_NAME, JSON.stringify(store.connection))
  })
}
