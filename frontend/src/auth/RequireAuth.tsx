import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import Topbar from '../components/Topbar'
import { useAuth } from './AuthContext'

/**
 * Gates its children behind a valid session. Must not redirect until the
 * initial hydration call in AuthContext has resolved — otherwise every page
 * refresh flash-redirects to /login even for a user with a valid token.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <Topbar />
      {children}
    </>
  )
}
