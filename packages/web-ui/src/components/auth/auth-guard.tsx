'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useIsAuthenticated } from '@/hooks/use-auth'
import { Loader2, Shield } from 'lucide-react'

interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Auth guard component - protects routes that require authentication
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useIsAuthenticated()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Store the intended destination for redirect after login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('atlas_redirect', pathname)
      }
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router, pathname])

  if (isLoading) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Shield className="h-12 w-12 text-primary animate-pulse" />
              <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-primary/30" />
            </div>
            <p className="text-sm text-muted-foreground">Authenticating...</p>
          </div>
        </div>
      )
    )
  }

  if (!isAuthenticated) {
    // Will redirect in useEffect, show nothing or loading
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    )
  }

  return <>{children}</>
}

/**
 * Redirect authenticated users away from auth pages
 */
export function GuestGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useIsAuthenticated()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Check for stored redirect destination
      const redirect = sessionStorage.getItem('atlas_redirect') || '/'
      sessionStorage.removeItem('atlas_redirect')
      router.push(redirect)
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
