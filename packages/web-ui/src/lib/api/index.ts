/**
 * Atlas API
 *
 * Central export for all API functions and types.
 */

// Core client
export { apiClient, apiGet, apiPost, apiPut, apiDelete, apiPatch, tokenManager, ApiError } from './client'

// Auth
export * from './auth'

// Preferences
export * from './preferences'

// Models
export * from './models'

// Memory
export * from './memory'

// Suggestions
export * from './suggestions'

// Approvals
export * from './approvals'

// Audit
export * from './audit'

// Dashboard
export * from './dashboard'

// Chat
export * from './chat'

// Files
export * from './files'

// Integrations
export * from './weather'
export * from './gmail'
export * from './calendar'
export * from './slack'
export * from './github'
