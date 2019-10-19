function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class API {
  login = async ({ username, password }) => {
    await sleep(1000)
    return { username, password }
  }
}

export default new API()
