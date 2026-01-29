'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import type { UserInfo } from '@/lib/api/auth'

/**
 * Auth context type
 */
interface AuthContextType {
  user: UserInfo | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<unknown>
  verifyMFA: (code: string, trustDevice?: boolean) => Promise<unknown>
  useBackupCode: (backupCode: string) => Promise<unknown>
  register: (username: string, password: string, email?: string) => Promise<unknown>
  completeMFASetup: (code: string) => Promise<unknown>
  logout: () => Promise<void>
  requiresMFA: boolean
  isRegistering: boolean
  registrationData: unknown
  isLoggingIn: boolean
  isLoggingOut: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Auth provider component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      // Import dynamically to avoid SSR issues
      import('@/lib/websocket-client').then(({ connectWS }) => {
        const ws = connectWS()
        // Authenticate the WebSocket connection
        if (auth.user?.id) {
          ws.authenticate('session-id', auth.user.id)
        }
      })
    }
  }, [auth.isAuthenticated, auth.user?.id])

  return (
    <AuthContext.Provider value={auth as AuthContextType}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context
 */
export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
