/**
 * Technical -> Plain Language Translation System
 *
 * Converts technical security terminology into approachable,
 * everyday language for non-technical users.
 */

export interface TranslatedTerm {
  technical: string
  plain: string
  description: string
  icon?: string // emoji for visual identification
}

/**
 * Core security term translations
 */
export const securityTerms: Record<string, TranslatedTerm> = {
  // Encryption
  'aes-256-gcm': {
    technical: 'AES-256-GCM encryption',
    plain: 'Bank-level encryption',
    description: 'Your data is protected with the same encryption used by banks and governments.',
    icon: '🔐',
  },
  'encryption-at-rest': {
    technical: 'Encryption at rest',
    plain: 'Protected storage',
    description: 'Your passwords and keys are scrambled when saved, so even if someone accessed the files, they couldn\'t read them.',
    icon: '💾',
  },
  'end-to-end-encryption': {
    technical: 'End-to-end encryption',
    plain: 'Private conversations',
    description: 'Only you and the intended recipient can read your messages - not even Atlas can see them.',
    icon: '🔒',
  },

  // Authentication
  'totp': {
    technical: 'TOTP authenticator',
    plain: 'Phone verification code',
    description: 'A 6-digit code from your phone app (like Google Authenticator) that changes every 30 seconds.',
    icon: '📱',
  },
  'mfa': {
    technical: 'Multi-factor authentication',
    plain: 'Two-step login',
    description: 'You need both your password AND a code from your phone to log in - much safer than password alone.',
    icon: '🛡️',
  },
  'backup-codes': {
    technical: 'Recovery codes',
    plain: 'Emergency login codes',
    description: 'One-time codes you can use if you lose access to your phone. Keep them somewhere safe!',
    icon: '🔑',
  },
  'jwt': {
    technical: 'JWT access token',
    plain: 'Login session',
    description: 'Keeps you logged in for a short time. You\'ll be asked to verify again after 15 minutes of inactivity.',
    icon: '⏱️',
  },
  'device-pairing': {
    technical: 'Device pairing with RSA-2048',
    plain: 'Trusted device',
    description: 'This device has been verified as yours and can access your account.',
    icon: '💻',
  },

  // Execution
  'sandbox': {
    technical: 'Sandbox execution',
    plain: 'Safe test environment',
    description: 'Commands run in an isolated space where they can\'t affect your real files or system.',
    icon: '📦',
  },
  'docker-container': {
    technical: 'Docker container',
    plain: 'Isolated workspace',
    description: 'A virtual room where Atlas runs tasks, completely separate from your personal files.',
    icon: '🏠',
  },
  'read-only-fs': {
    technical: 'Read-only filesystem',
    plain: 'View-only mode',
    description: 'Atlas can look at files but can\'t change anything without your permission.',
    icon: '👀',
  },
  'allowlist': {
    technical: 'Command allowlist',
    plain: 'Approved commands',
    description: 'Only these pre-approved commands can run. Everything else is blocked by default.',
    icon: '✅',
  },
  'deny-by-default': {
    technical: 'Deny-by-default policy',
    plain: 'Only approved actions run',
    description: 'Atlas won\'t do anything unless it\'s on your approved list - safer than allowing everything.',
    icon: '🚫',
  },

  // Security Events
  'prompt-injection': {
    technical: 'Prompt injection blocked',
    plain: 'Blocked a trick attempt',
    description: 'Someone tried to trick Atlas into doing something unauthorized. The attempt was detected and blocked.',
    icon: '🛑',
  },
  'credential-exfiltration': {
    technical: 'Credential exfiltration attempt',
    plain: 'Password theft attempt blocked',
    description: 'Atlas detected an attempt to steal your passwords or keys and stopped it.',
    icon: '🚨',
  },
  'rate-limiting': {
    technical: 'Rate limiting applied',
    plain: 'Slowing down requests',
    description: 'Too many requests came in too quickly. This helps prevent attacks.',
    icon: '⏳',
  },
  'zero-trust': {
    technical: 'Zero-trust network',
    plain: 'Verify everything',
    description: 'Every connection is verified, even from inside your network. No automatic trust.',
    icon: '🔍',
  },
  'ip-allowlist': {
    technical: 'IP allowlist',
    plain: 'Approved locations',
    description: 'Only connections from these specific locations are allowed.',
    icon: '📍',
  },

  // Credentials
  'credential-rotation': {
    technical: 'Credential rotation',
    plain: 'Refresh your password',
    description: 'Changing passwords regularly helps keep your accounts secure, like changing locks.',
    icon: '🔄',
  },
  'api-key': {
    technical: 'API key',
    plain: 'Service password',
    description: 'A special password that lets Atlas connect to other services on your behalf.',
    icon: '🗝️',
  },
  'oauth-token': {
    technical: 'OAuth token',
    plain: 'App permission',
    description: 'Permission you gave Atlas to access another service without sharing your password.',
    icon: '🎫',
  },

  // Models
  'local-model': {
    technical: 'Local model inference',
    plain: 'Private AI (on your computer)',
    description: 'AI running on your own computer - your data never leaves your machine.',
    icon: '🏠',
  },
  'cloud-api': {
    technical: 'Cloud API call',
    plain: 'Online AI service',
    description: 'Using a powerful online AI service (usage fees may apply).',
    icon: '☁️',
  },
  'token-usage': {
    technical: 'Token consumption',
    plain: 'AI usage',
    description: 'How much you\'re using the AI service. More complex tasks use more.',
    icon: '📊',
  },
  'context-window': {
    technical: 'Context window',
    plain: 'Conversation memory',
    description: 'How much of your conversation the AI can remember at once.',
    icon: '🧠',
  },

  // Network
  'localhost': {
    technical: 'Localhost connection',
    plain: 'Your computer only',
    description: 'Connection that stays on your computer - can\'t be accessed from the internet.',
    icon: '🖥️',
  },
  'reverse-proxy': {
    technical: 'Reverse proxy',
    plain: 'Connection router',
    description: 'A middleman that routes internet traffic to your services.',
    icon: '🔀',
  },
  'cidr': {
    technical: 'CIDR notation',
    plain: 'Network range',
    description: 'A way to describe a range of IP addresses (internet locations).',
    icon: '🌐',
  },
}

/**
 * Translate a technical term to plain language
 */
export function translate(technicalTerm: string): string {
  const key = technicalTerm.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return securityTerms[key]?.plain ?? technicalTerm
}

/**
 * Get full translation info for a term
 */
export function getTranslation(technicalTerm: string): TranslatedTerm | null {
  const key = technicalTerm.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return securityTerms[key] ?? null
}

/**
 * Get description for a term (useful for tooltips)
 */
export function getDescription(technicalTerm: string): string {
  const key = technicalTerm.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return securityTerms[key]?.description ?? ''
}

/**
 * Replace technical terms in a string with plain language equivalents
 */
export function translateText(text: string): string {
  let result = text

  // Sort by technical term length (longest first) to avoid partial replacements
  const sortedTerms = Object.values(securityTerms).sort(
    (a, b) => b.technical.length - a.technical.length
  )

  for (const term of sortedTerms) {
    const regex = new RegExp(term.technical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    result = result.replace(regex, term.plain)
  }

  return result
}

/**
 * Error message translations - maps error codes to user-friendly messages
 */
export const errorTranslations: Record<string, { title: string; message: string; action?: string }> = {
  'AUTH_REQUIRED': {
    title: 'Login required',
    message: 'You need to log in to continue.',
    action: 'Go to login page',
  },
  'MFA_REQUIRED': {
    title: 'Verification needed',
    message: 'Please enter the code from your authenticator app.',
    action: 'Enter verification code',
  },
  'MFA_INVALID': {
    title: 'Wrong code',
    message: 'That code didn\'t work. Check your authenticator app and try the newest code.',
    action: 'Try again',
  },
  'SESSION_EXPIRED': {
    title: 'Session ended',
    message: 'Your session has expired for security. Please log in again.',
    action: 'Log in again',
  },
  'DEVICE_NOT_TRUSTED': {
    title: 'New device detected',
    message: 'This device hasn\'t been verified yet. You\'ll need to complete additional verification.',
    action: 'Verify this device',
  },
  'CREDENTIAL_DECRYPT_FAILED': {
    title: 'Can\'t access password',
    message: 'There was a problem unlocking your saved password. This can happen if you\'re on a different device.',
    action: 'Re-enter credential',
  },
  'SANDBOX_UNAVAILABLE': {
    title: 'Safe mode unavailable',
    message: 'The safe execution environment isn\'t running. Commands can\'t run without it.',
    action: 'Check Docker is running',
  },
  'COMMAND_NOT_ALLOWED': {
    title: 'Command blocked',
    message: 'This command isn\'t on the approved list. For safety, only approved commands can run.',
    action: 'View approved commands',
  },
  'INJECTION_DETECTED': {
    title: 'Suspicious request blocked',
    message: 'Atlas detected something unusual in the request that could be a security risk.',
    action: 'Learn more',
  },
  'RATE_LIMITED': {
    title: 'Too many requests',
    message: 'You\'re making requests too quickly. Wait a moment and try again.',
    action: 'Wait 60 seconds',
  },
  'NETWORK_BLOCKED': {
    title: 'Connection blocked',
    message: 'This connection isn\'t from an approved location.',
    action: 'Check network settings',
  },
  'COST_LIMIT_EXCEEDED': {
    title: 'Usage limit reached',
    message: 'You\'ve reached your daily AI usage budget. Increase your limit or wait until tomorrow.',
    action: 'Adjust budget',
  },
  'MODEL_UNAVAILABLE': {
    title: 'AI service unavailable',
    message: 'The AI service is temporarily unavailable. Trying alternative...',
  },
  'TIMEOUT': {
    title: 'Request timed out',
    message: 'The operation took too long. This might be a complex task or the service is busy.',
    action: 'Try again',
  },
}

/**
 * Get a user-friendly error message
 */
export function translateError(
  errorCode: string,
  details?: string
): { title: string; message: string; action?: string } {
  const translation = errorTranslations[errorCode]

  if (translation) {
    return {
      ...translation,
      message: details ? `${translation.message} (${details})` : translation.message,
    }
  }

  // Fallback for unknown errors
  return {
    title: 'Something went wrong',
    message: details ?? 'An unexpected error occurred. Please try again.',
    action: 'Try again',
  }
}

/**
 * Status translations for different system states
 */
export const statusTranslations: Record<string, { label: string; description: string }> = {
  'connected': { label: 'Connected', description: 'Everything is working normally.' },
  'disconnected': { label: 'Disconnected', description: 'Not connected. Check your internet.' },
  'authenticating': { label: 'Verifying...', description: 'Checking your identity.' },
  'executing': { label: 'Working...', description: 'Running your request in a safe environment.' },
  'waiting-approval': { label: 'Needs your OK', description: 'This action needs your approval before it can run.' },
  'blocked': { label: 'Blocked', description: 'This action was blocked for security reasons.' },
  'completed': { label: 'Done', description: 'Task completed successfully.' },
  'failed': { label: 'Failed', description: 'Something went wrong. Check the details below.' },
}
