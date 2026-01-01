import { fakeApi } from './fakeApi'

const url = import.meta.env.VITE_API_URL || '/api/'
let authToken = ''

export function setAuthToken(token) {
  authToken = token
}

async function apiFetch(path, headers = {}) {
  if (import.meta.env.VITE_FAKE_API) {
    return await fakeApi(path)
  }

  const auth = authToken ? { Authorization: `Bearer ${authToken}` } : {}
  return fetch(url + path, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...auth, ...headers },
  }).then(res => res.text())
    .then(res => {
      try {
        return JSON.parse(res)
      } catch (error) {
        return { errors: [typeof res === 'string' ? (res || 'Unknown error') : error.message] }
      }
    })
    .catch(error => ({ errors: [error.message] }))
}

class API {
  login = async ({ username, password }) => {
    return apiFetch('auth', { 'Authorization': 'Basic ' + btoa(username + ':' + password) })
  }

  fetch = apiFetch
}

export default new API()
