import { fakeApi } from './fakeApi'

const url = import.meta.env.VITE_API_URL || '/api/'

type ApiResponse<T = unknown> = {
  data?: T,
  errors?: string[],
}

async function apiFetch<T>(path: string, headers: HeadersInit = {}): Promise<ApiResponse<T>> {
  if (import.meta.env.VITE_FAKE_API) {
    return await fakeApi(path) as ApiResponse<T>
  }

  console.log('API Fetch:', url + path, headers)
  const fetchHeaders = new Headers(headers)
  fetchHeaders.append('Content-Type', 'application/json')
  const token = window.store?.connection?.token
  if (token && !fetchHeaders.has('Authorization')) {
    fetchHeaders.append('Authorization', `Bearer ${token}`)
  }
  
  return fetch(url + path, {
    method: 'GET',
    headers: fetchHeaders,
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

class API {
  login = async (username: string, password: string) => {
    return apiFetch<{token: string}>('auth', { 'Authorization': 'Basic ' + btoa(username + ':' + password) })
  }

  fetch = apiFetch
}

export default new API()
