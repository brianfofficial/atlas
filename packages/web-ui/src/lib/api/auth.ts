/**
 * Auth API functions
 *
 * Handles authentication operations against the gateway.
 */

import { apiPost, tokenManager, ApiError } from './client'

/**
 * Auth response types
 */
export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginResponse {
  requiresMFA: boolean
  mfaToken?: string // Temporary token to use for MFA verification
  tokens?: AuthTokens // Only present if MFA not required (shouldn't happen in Atlas)
  user?: UserInfo
}

export interface MFAVerifyResponse {
  tokens: AuthTokens
  user: UserInfo
}

export interface UserInfo {
  id: string
  username: string
  email?: string
  mfaEnabled: boolean
  createdAt: string
  lastLoginAt?: string
}

export interface RegisterResponse {
  user: UserInfo
  mfaSetup: {
    secret: string
    qrCodeUrl: string
    backupCodes: string[]
  }
}

export interface MFASetupResponse {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

/**
 * Login with email/username and password
 * Returns either tokens (if MFA not required) or mfaToken for MFA step
 */
export async function login(credentials: {
  email: string
  password: string
  deviceFingerprint?: string
}): Promise<LoginResponse> {
  const response = await apiPost<LoginResponse>('/api/auth/login', credentials, {
    skipAuth: true,
  } as RequestInit)

  // If tokens are returned directly (no MFA), store them
  if (response.tokens) {
    tokenManager.setTokens(response.tokens.accessToken, response.tokens.refreshToken)
  }

  return response
}

/**
 * Verify MFA code after initial login
 */
export async function verifyMFA(params: {
  mfaToken: string
  code: string
  deviceFingerprint?: string
  trustDevice?: boolean
}): Promise<MFAVerifyResponse> {
  const response = await apiPost<MFAVerifyResponse>('/api/auth/mfa/verify', params, {
    skipAuth: true,
  } as RequestInit)

  // Store the tokens after successful MFA
  tokenManager.setTokens(response.tokens.accessToken, response.tokens.refreshToken)

  return response
}

/**
 * Register a new user (initiates MFA setup)
 */
export async function register(params: {
  username: string
  email?: string
  password: string
}): Promise<RegisterResponse> {
  return apiPost<RegisterResponse>('/api/auth/register', params, {
    skipAuth: true,
  } as RequestInit)
}

/**
 * Complete MFA setup during registration
 */
export async function completeMFASetup(params: {
  userId: string
  code: string
  deviceFingerprint?: string
}): Promise<MFAVerifyResponse> {
  const response = await apiPost<MFAVerifyResponse>('/api/auth/mfa/setup/complete', params, {
    skipAuth: true,
  } as RequestInit)

  tokenManager.setTokens(response.tokens.accessToken, response.tokens.refreshToken)

  return response
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<UserInfo> {
  return apiPost<UserInfo>('/api/auth/me', {})
}

/**
 * Logout - clears tokens and invalidates session on server
 */
export async function logout(): Promise<void> {
  try {
    await apiPost('/api/auth/logout', {})
  } catch {
    // Ignore errors during logout
  } finally {
    tokenManager.clearTokens()
  }
}

/**
 * Refresh MFA setup (get new secret/QR code)
 */
export async function refreshMFASetup(): Promise<MFASetupResponse> {
  return apiPost<MFASetupResponse>('/api/auth/mfa/refresh', {})
}

/**
 * Use backup code for recovery
 */
export async function useBackupCode(params: {
  mfaToken: string
  backupCode: string
}): Promise<MFAVerifyResponse> {
  const response = await apiPost<MFAVerifyResponse>('/api/auth/mfa/backup', params, {
    skipAuth: true,
  } as RequestInit)

  tokenManager.setTokens(response.tokens.accessToken, response.tokens.refreshToken)

  return response
}

/**
 * Check if authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
  return tokenManager.isAuthenticated()
}

/**
 * Get stored token
 */
export function getToken(): string | null {
  return tokenManager.getToken()
}

/**
 * Check for auth errors
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}
