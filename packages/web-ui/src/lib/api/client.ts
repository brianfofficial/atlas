/**
 * Atlas API Client
 *
 * Base fetch wrapper with authentication, error handling, and token management.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18789'

/**
 * Token storage keys
 */
const TOKEN_KEY = 'atlas_token'
const REFRESH_TOKEN_KEY = 'atlas_refresh_token'

/**
 * API error with structured information
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Token management utilities
 */
export const tokenManager = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },

  setTokens(accessToken: string, refreshToken?: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(TOKEN_KEY, accessToken)
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }
  },

  clearTokens(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },

  isAuthenticated(): boolean {
    return !!this.getToken()
  },
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenManager.getRefreshToken()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      tokenManager.clearTokens()
      return false
    }

    const data = await response.json()
    tokenManager.setTokens(data.accessToken, data.refreshToken)
    return true
  } catch {
    tokenManager.clearTokens()
    return false
  }
}

/**
 * Core API client function
 */
export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options || {}
  const token = tokenManager.getToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  })

  // Handle token expiration - try refresh once
  if (response.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      // Retry with new token
      const newToken = tokenManager.getToken()
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...fetchOptions,
        headers: {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        },
      })
    } else {
      // Redirect to login on auth failure
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new ApiError('Authentication required', 401, 'AUTH_REQUIRED')
    }
  }

  if (!response.ok) {
    let errorData: { message?: string; code?: string; details?: Record<string, unknown> } = {}
    try {
      errorData = await response.json()
    } catch {
      // Response may not be JSON
    }

    throw new ApiError(
      errorData.message || `API error: ${response.status}`,
      response.status,
      errorData.code,
      errorData.details
    )
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T
  }

  return response.json()
}

/**
 * GET request helper
 */
export function apiGet<T>(endpoint: string, options?: Omit<RequestInit, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'GET' })
}

/**
 * POST request helper
 */
export function apiPost<T>(endpoint: string, body?: unknown, options?: Omit<RequestInit, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * PUT request helper
 */
export function apiPut<T>(endpoint: string, body?: unknown, options?: Omit<RequestInit, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * DELETE request helper
 */
export function apiDelete<T>(endpoint: string, options?: Omit<RequestInit, 'method'>): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'DELETE' })
}

/**
 * PATCH request helper
 */
export function apiPatch<T>(endpoint: string, body?: unknown, options?: Omit<RequestInit, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })
}
