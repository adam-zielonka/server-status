import { fakeApi } from './fakeApi'

const url = import.meta.env.VITE_API_URL || '/api/'

type ApiResponse<T = unknown> = {
  data?: T,
  errors?: string[],
}

function prepareHeaders(headersInit: HeadersInit = {}): Headers {
  const headers = new Headers(headersInit)
  headers.append('Content-Type', 'application/json')

  const token = window.store?.connection?.token
  if (token && !headers.has('Authorization')) {
    headers.append('Authorization', `Bearer ${token}`)
  }

  return headers
}

class API {
  fetch = async function<T>(path: string, headers: HeadersInit = {}): Promise<ApiResponse<T>> {
    if (import.meta.env.VITE_FAKE_API) {
      return await fakeApi(path) as ApiResponse<T>
    }
  
    return fetch(url + path, {
      method: 'GET',
      headers: prepareHeaders(headers),
    }).then(res => res.text())
      .then(res => {
        try {
          return JSON.parse(res)
        } catch (error) {
          if (typeof res === 'string') {
            return { errors: [res || 'Unknown error'] }
          }

          if (error instanceof Error) {
            return { errors: [error.message] }
          }

          return { errors: ['Unknown error'] }
        }
      })
      .catch(error => ({ errors: [error.message] }))
  }

  login = async (username: string, password: string) => {
    return this.fetch<{token: string}>('auth', { 'Authorization': 'Basic ' + btoa(username + ':' + password) })
  }
}

export default new API()
