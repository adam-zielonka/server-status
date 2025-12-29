import { fakeApi } from './fakeApi'

async function apiFetch({ url, token, query, variables }) {
  const auth = token ? { Authorization: `Bearer ${token}` } : {}

  if (import.meta.env.VITE_FAKE_API) {
    return await fakeApi()
  }

  return fetch(url, {
    body: JSON.stringify({ query, variables }),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
  }).then(res => res.text())
    .then(res => {
      try {
        return JSON.parse(res)
      } catch (error) {
        return { errors: [{ message: typeof res === 'string' ? res : error.message }] }
      }
    })
    .catch(error => ({ errors: [{ message: error.message }] }))
}

class API {
  login = async ({ url, username, password }) => apiFetch({
    url, variables: { username, password }, query: `
      query($username: String!, $password: String!) {
        login(name: $username, pass: $password) {
          token
          user {
            name
          }
        }
      }`,
  })

  getData = async props => apiFetch(props)
}

export default new API()
