import { fakeApi } from './fakeApi'

const url = import.meta.env.VITE_API_URL || '/api/'

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

async function apiFetch2(path, headers = {}) {
  const token = window.store?.connection?.token
  const auth = token ? { Authorization: `Bearer ${token}` } : {}
  return fetch(url + path, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...auth, ...headers },
  }).then(res => res.text())
    .then(res => {
      try {
        return JSON.parse(res)
      } catch (error) {
        return { errors: [typeof res === 'string' ? res : error.message] }
      }
    })
    .catch(error => ({ errors: [error.message] }))
}

class API {
  login = async ({ username, password }) => {
    return apiFetch2('auth', { 'Authorization': 'Basic ' + btoa(username + ':' + password) })
  }

  getData = async props => apiFetch(props)

  fetch = apiFetch2
}

export default new API()
