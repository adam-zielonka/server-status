import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, authenticate, fetchEndpoint, isDemo } from '@/lib/api'
import { readSession, storeSession } from '@/lib/session'
import type { Session } from '@/types'

interface AuthContextValue {
  session: Session | null
  checking: boolean
  signingIn: boolean
  error: string
  validationError: string
  signIn: (user: string, password: string) => Promise<void>
  signOut: (message?: string) => void
  retry: () => void
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(() =>
    isDemo ? { user: 'demo', token: 'demo-session' } : readSession(),
  )
  const [checking, setChecking] = useState(() => !isDemo && readSession() !== null)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const signOut = useCallback(
    (message = '') => {
      queryClient.clear()
      storeSession(null)
      setSession(null)
      setChecking(false)
      setValidationError('')
      setError(message)
    },
    [queryClient],
  )

  useEffect(() => {
    if (!session || isDemo) return
    const controller = new AbortController()
    fetchEndpoint('ok', session.token, controller.signal)
      .then(() => {
        if (controller.signal.aborted) return
        setChecking(false)
        setValidationError('')
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        if (reason instanceof ApiError && reason.status === 401) signOut(reason.message)
        else {
          setValidationError(
            reason instanceof Error ? reason.message : 'Could not connect to the server.',
          )
          setChecking(false)
        }
      })
    return () => controller.abort()
  }, [session, attempt, signOut])

  const signIn = async (user: string, password: string) => {
    setSigningIn(true)
    setError('')
    try {
      const next = await authenticate(user.trim(), password)
      queryClient.clear()
      storeSession(next)
      setSession(next)
      setValidationError('')
      setChecking(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in. Try again.')
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        checking,
        signingIn,
        error,
        validationError,
        signIn,
        signOut,
        retry: () => {
          setChecking(true)
          setAttempt((value) => value + 1)
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
