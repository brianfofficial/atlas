/**
 * Atlas Security Types
 * Core type definitions for the security subsystem
 */

// ============================================================================
// Credential Storage Types
// ============================================================================

export interface StoredCredential {
  /** Unique identifier for this credential */
  id: string;
  /** Human-readable name (e.g., "OpenAI API Key") */
  name: string;
  /** Service this credential is for */
  service: CredentialService;
  /** Encrypted credential value (never stored in plaintext) */
  encryptedValue: string;
  /** Initialization vector for AES-GCM */
  iv: string;
  /** Authentication tag for AES-GCM */
  authTag: string;
  /** When this credential was created */
  createdAt: Date;
  /** When this credential was last rotated */
  lastRotatedAt: Date;
  /** Optional expiration date */
  expiresAt?: Date;
}

export type CredentialService =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'azure'
  | 'aws'
  | 'github'
  | 'slack'
  | 'discord'
  | 'telegram'
  | 'custom';

export interface CredentialStoreConfig {
  /** Use OS keychain (keytar) as primary storage */
  useKeychain: boolean;
  /** Fallback to file-based encrypted storage */
  fallbackToFile: boolean;
  /** Path for file-based storage (if keychain unavailable) */
  storagePath: string;
  /** Auto-rotate credentials older than this (days) */
  rotationReminderDays: number;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthConfig {
  /** JWT signing secret (derived from device fingerprint) */
  jwtSecret: string;
  /** Token expiration in seconds (default: 900 = 15 minutes) */
  tokenExpiration: number;
  /** Refresh token expiration in seconds (default: 604800 = 7 days) */
  refreshTokenExpiration: number;
  /** MFA is ALWAYS required - no bypass option */
  mfaRequired: true;
  /** Maximum failed login attempts before lockout */
  maxFailedAttempts: number;
  /** Lockout duration in seconds */
  lockoutDuration: number;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  mfaSecret: string;
  mfaEnabled: boolean;
  devices: PairedDevice[];
  createdAt: Date;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
}

export interface PairedDevice {
  id: string;
  name: string;
  fingerprint: string;
  publicKey: string;
  pairedAt: Date;
  lastSeenAt: Date;
  trusted: boolean;
}

export interface JWTPayload {
  sub: string; // User ID
  deviceId: string;
  iat: number;
  exp: number;
  mfaVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginAttempt {
  userId: string;
  timestamp: Date;
  success: boolean;
  ipAddress: string;
  deviceFingerprint: string;
  failureReason?: LoginFailureReason;
}

export type LoginFailureReason =
  | 'invalid_password'
  | 'invalid_mfa'
  | 'account_locked'
  | 'device_not_trusted'
  | 'session_expired';

// ============================================================================
// Network Security Types
// ============================================================================

export interface NetworkConfig {
  /** Allowed IP addresses/CIDR ranges */
  allowedIPs: string[];
  /** Explicitly blocked IPs */
  blockedIPs: string[];
  /** Allow localhost connections (DANGEROUS - default false) */
  allowLocalhost: boolean;
  /** Require VPN/Tailscale for remote access */
  requireVPN: boolean;
  /** Port to listen on (default: 18789) */
  port: number;
  /** Bind address (default: 127.0.0.1 for local-only) */
  bindAddress: string;
  /** Enable TLS */
  tlsEnabled: boolean;
  /** TLS certificate path */
  tlsCertPath?: string;
  /** TLS key path */
  tlsKeyPath?: string;
}

export interface NetworkRequest {
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  path: string;
  method: string;
  authenticated: boolean;
}

export type NetworkSecurityEvent =
  | { type: 'blocked_ip'; ip: string; reason: string }
  | { type: 'public_exposure_detected'; details: string }
  | { type: 'suspicious_request'; request: NetworkRequest }
  | { type: 'rate_limit_exceeded'; ip: string };

// ============================================================================
// Sandbox Types
// ============================================================================

export interface SandboxConfig {
  /** Docker image to use */
  image: string;
  /** Memory limit (e.g., "512m") */
  memoryLimit: string;
  /** CPU limit (e.g., "0.5") */
  cpuLimit: string;
  /** Read-only root filesystem */
  readOnlyRootFs: boolean;
  /** Drop all capabilities */
  dropAllCapabilities: boolean;
  /** Allowed network hosts */
  networkAllowlist: string[];
  /** Workspace directory inside container */
  workspaceDir: string;
  /** Host directory to mount as workspace */
  hostWorkspaceDir: string;
  /** Execution timeout in milliseconds */
  timeoutMs: number;
}

export interface SandboxExecutionRequest {
  command: string;
  args: string[];
  workingDir?: string;
  env?: Record<string, string>;
  stdin?: string;
  timeoutMs?: number;
}

export interface SandboxExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  memoryUsedBytes?: number;
}

// ============================================================================
// Allowlist Types
// ============================================================================

export interface AllowlistConfig {
  /** Default policy: deny all unless explicitly allowed */
  defaultPolicy: 'deny';
  /** Commands that are always allowed */
  safeCommands: CommandDefinition[];
  /** Commands that require explicit approval */
  dangerousCommands: CommandDefinition[];
  /** Directories the sandbox can access */
  allowedDirectories: DirectoryPermission[];
  /** File patterns that are never accessible */
  blockedPatterns: string[];
}

export interface CommandDefinition {
  /** Command name (e.g., "ls", "cat") */
  name: string;
  /** Allowed arguments pattern (regex) */
  allowedArgs?: string;
  /** Blocked arguments pattern (regex) */
  blockedArgs?: string;
  /** Risk level */
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  /** Human-readable description */
  description: string;
}

export interface DirectoryPermission {
  path: string;
  permissions: ('read' | 'write' | 'execute')[];
  recursive: boolean;
}

export interface AllowlistDecision {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
}

// ============================================================================
// Input Sanitization Types
// ============================================================================

export interface SanitizerConfig {
  /** Enable XML-tagged isolation */
  useXMLIsolation: boolean;
  /** Block known injection patterns */
  blockKnownPatterns: boolean;
  /** Maximum input length */
  maxInputLength: number;
  /** Trust levels for different sources */
  trustLevels: TrustLevelConfig;
}

export interface TrustLevelConfig {
  /** Internal system messages */
  system: TrustLevel;
  /** User input from authenticated sessions */
  authenticatedUser: TrustLevel;
  /** External web content */
  externalWeb: TrustLevel;
  /** Email content */
  email: TrustLevel;
  /** API responses */
  apiResponse: TrustLevel;
}

export type TrustLevel = 'trusted' | 'semi-trusted' | 'untrusted';

export interface SanitizedInput {
  originalInput: string;
  sanitizedInput: string;
  source: InputSource;
  trustLevel: TrustLevel;
  injectionAttemptDetected: boolean;
  sanitizationApplied: string[];
}

export type InputSource =
  | 'system'
  | 'user'
  | 'web'
  | 'email'
  | 'api'
  | 'file'
  | 'unknown';

// ============================================================================
// Output Validation Types
// ============================================================================

export interface OutputValidatorConfig {
  /** Patterns that indicate credential exfiltration */
  exfiltrationPatterns: string[];
  /** Block outbound API calls to unknown hosts */
  blockUnknownAPIs: boolean;
  /** Rate limit sensitive operations */
  rateLimitSensitiveOps: boolean;
  /** Maximum operations per minute */
  maxOpsPerMinute: number;
}

export interface OutputValidationResult {
  valid: boolean;
  blocked: boolean;
  reason?: string;
  suspiciousPatterns: string[];
  riskScore: number; // 0-100
}

// ============================================================================
// Error Types
// ============================================================================

export class AtlasSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: SecurityErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AtlasSecurityError';
  }
}

export type SecurityErrorCode =
  | 'CREDENTIAL_STORE_UNAVAILABLE'
  | 'CREDENTIAL_NOT_FOUND'
  | 'CREDENTIAL_DECRYPTION_FAILED'
  | 'AUTH_REQUIRED'
  | 'MFA_REQUIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'DEVICE_NOT_TRUSTED'
  | 'ACCOUNT_LOCKED'
  | 'NETWORK_BLOCKED'
  | 'PUBLIC_EXPOSURE'
  | 'SANDBOX_UNAVAILABLE'
  | 'COMMAND_NOT_ALLOWED'
  | 'DIRECTORY_ACCESS_DENIED'
  | 'INJECTION_DETECTED'
  | 'EXFILTRATION_BLOCKED'
  | 'RATE_LIMIT_EXCEEDED';
