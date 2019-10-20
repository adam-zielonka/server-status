/* eslint-disable no-param-reassign */
import { autorun } from 'mobx'

const STORAGE_NAME = 'beta_server_status'

export default function (_this) {
  let firstRun = true

  autorun(() => {
    if (firstRun) {
      const user = JSON.parse(localStorage.getItem(STORAGE_NAME))
      if (user) _this.user = user
    }

    localStorage.setItem(STORAGE_NAME, JSON.stringify(_this.user))
  })

  firstRun = false
}
