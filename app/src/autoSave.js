import { autorun } from 'mobx'

const STORAGE_NAME = 'beta_connection'

export default function (_this) {
  let firstRun = true

  autorun(() => {
    if (firstRun) {
      const connection = JSON.parse(localStorage.getItem(STORAGE_NAME))
      if (connection) _this.connection = connection
    }

    localStorage.setItem(STORAGE_NAME, JSON.stringify(_this.connection))
  })

  firstRun = false
}
