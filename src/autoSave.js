/* eslint-disable no-param-reassign */
import { autorun } from 'mobx'

const STORAGE_NAME = 'beta_connections'

export default function (_this) {
  let firstRun = true

  autorun(() => {
    if (firstRun) {
      const connections = JSON.parse(localStorage.getItem(STORAGE_NAME))
      if (connections) _this.connections = connections
      if (connections && connections.length) _this.ID.connection = 0
    }

    localStorage.setItem(STORAGE_NAME, JSON.stringify(_this.connections))
  })

  firstRun = false
}
