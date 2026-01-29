'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  login as apiLogin,
  verifyMFA as apiVerifyMFA,
  register as apiRegister,
  completeMFASetup as apiCompleteMFASetup,
  logout as apiLogout,
  getCurrentUser,
  useBackupCode as apiUseBackupCode,
  isAuthenticated as checkAuthenticated,
  type LoginResponse,
  type MFAVerifyResponse,
  type RegisterResponse,
  type UserInfo,
} from '@/lib/api/auth'

/**
 * Auth state
 */
export interface AuthState {
  user: UserInfo | null
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
}

/**
 * Hook for authentication operations
 */
export function useAuth() {
  const queryClient = useQueryClient()
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [registrationData, setRegistrationData] = useState<RegisterResponse | null>(null)

  // Query for current user (only when authenticated)
  const {
    data: user,
    isLoading: isLoadingUser,
    error: userError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: getCurrentUser,
    enabled: checkAuthenticated(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: apiLogin,
    onSuccess: (response: LoginResponse) => {
      if (response.requiresMFA && response.mfaToken) {
        setMfaToken(response.mfaToken)
      } else if (response.user) {
        queryClient.setQueryData(['auth', 'user'], response.user)
      }
    },
  })

  // MFA verification mutation
  const verifyMFAMutation = useMutation({
    mutationFn: apiVerifyMFA,
    onSuccess: (response: MFAVerifyResponse) => {
      setMfaToken(null)
      queryClient.setQueryData(['auth', 'user'], response.user)
    },
  })

  // Backup code mutation
  const useBackupCodeMutation = useMutation({
    mutationFn: apiUseBackupCode,
    onSuccess: (response: MFAVerifyResponse) => {
      setMfaToken(null)
      queryClient.setQueryData(['auth', 'user'], response.user)
    },
  })

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: apiRegister,
    onSuccess: (response: RegisterResponse) => {
      setRegistrationData(response)
    },
  })

  // Complete MFA setup mutation
  const completeMFASetupMutation = useMutation({
    mutationFn: apiCompleteMFASetup,
    onSuccess: (response: MFAVerifyResponse) => {
      setRegistrationData(null)
      queryClient.setQueryData(['auth', 'user'], response.user)
    },
  })

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'user'], null)
      queryClient.clear()
    },
  })

  // Login function
  const login = useCallback(
    async (email: string, password: string) => {
      return loginMutation.mutateAsync({ email, password })
    },
    [loginMutation]
  )

  // Verify MFA function
  const verifyMFA = useCallback(
    async (code: string, trustDevice?: boolean) => {
      if (!mfaToken) {
        throw new Error('No MFA token available. Please login first.')
      }
      return verifyMFAMutation.mutateAsync({ mfaToken, code, trustDevice })
    },
    [mfaToken, verifyMFAMutation]
  )

  // Use backup code function
  const useBackupCode = useCallback(
    async (backupCode: string) => {
      if (!mfaToken) {
        throw new Error('No MFA token available. Please login first.')
      }
      return useBackupCodeMutation.mutateAsync({ mfaToken, backupCode })
    },
    [mfaToken, useBackupCodeMutation]
  )

  // Register function
  const register = useCallback(
    async (username: string, password: string, email?: string) => {
      return registerMutation.mutateAsync({ username, password, email })
    },
    [registerMutation]
  )

  // Complete MFA setup function
  const completeMFASetup = useCallback(
    async (code: string) => {
      if (!registrationData) {
        throw new Error('No registration data available. Please register first.')
      }
      return completeMFASetupMutation.mutateAsync({
        userId: registrationData.user.id,
        code,
      })
    },
    [registrationData, completeMFASetupMutation]
  )

  // Logout function
  const logout = useCallback(async () => {
    return logoutMutation.mutateAsync()
  }, [logoutMutation])

  // Cancel login/registration and reset state
  const cancelAuth = useCallback(() => {
    setMfaToken(null)
    setRegistrationData(null)
  }, [])

  return {
    // State
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading: isLoadingUser,
    error: userError,

    // MFA state
    requiresMFA: !!mfaToken,
    mfaToken,

    // Registration state
    isRegistering: !!registrationData,
    registrationData,

    // Actions
    login,
    verifyMFA,
    useBackupCode,
    register,
    completeMFASetup,
    logout,
    cancelAuth,
    refetchUser,

    // Mutation states
    isLoggingIn: loginMutation.isPending,
    isVerifyingMFA: verifyMFAMutation.isPending,
    isUsingBackupCode: useBackupCodeMutation.isPending,
    isSubmittingRegistration: registerMutation.isPending,
    isCompletingMFASetup: completeMFASetupMutation.isPending,
    isLoggingOut: logoutMutation.isPending,

    // Mutation errors
    loginError: loginMutation.error,
    verifyMFAError: verifyMFAMutation.error,
    registerError: registerMutation.error,
    completeMFASetupError: completeMFASetupMutation.error,
    logoutError: logoutMutation.error,
  }
}

/**
 * Hook to check if user is authenticated (simpler version)
 */
export function useIsAuthenticated() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: getCurrentUser,
    enabled: checkAuthenticated(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return {
    isAuthenticated: !!user,
    isLoading,
  }
}
