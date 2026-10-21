import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  clearStoredToken,
  getMe,
  getStoredToken,
  login as apiLogin,
  register as apiRegister,
  setStoredToken,
} from '../api/client'
import type { CurrentUser } from '../api/client'

interface AuthContextValue {
  user: CurrentUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Hydrate the session from a stored token on mount, so a page refresh
  // doesn't log the user out. `loading` must stay true until this resolves
  // (success, 401, or network error) — RequireAuth depends on that ordering.
  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setLoading(false)
      return
    }

    getMe(token)
      .then((me) => setUser(me))
      .catch(() => {
        clearStoredToken()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const result = await apiLogin(email, password)
    setStoredToken(result.token)
    setUser({ id: result.id, email: result.email })
  }

  async function register(email: string, password: string) {
    const result = await apiRegister(email, password)
    setStoredToken(result.token)
    setUser({ id: result.id, email: result.email })
  }

  function logout() {
    clearStoredToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
