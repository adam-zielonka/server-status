class API {
  login = async ({ url, username, password }) => {
    const query = `
      mutation($username: String!, $password: String!) {
        login(name: $username, pass: $password) {
          token
          user {
            name
          }
        }
      }
    `

    const response = await fetch(url, {
      body: JSON.stringify({
        query,
        variables: { username, password },
      }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.text())
      .then(res => {
        try {
          return JSON.parse(res)
        } catch (error) {
          return { errors: [{ message: typeof res === 'string' ? res : error.message }] }
        }
      })
      .catch(error => ({ errors: [{ message: error.message }] }))

    return response
  }
}

export default new API()
