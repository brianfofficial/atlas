/**
 * Atlas Output Validator
 *
 * Validates agent outputs to detect credential exfiltration and block suspicious operations.
 * Last line of defense against compromised agent behavior.
 *
 * @module @atlas/gateway/security/output-validator
 */

import type { OutputValidatorConfig, OutputValidationResult } from '@atlas/shared';

// Patterns that indicate credential exfiltration attempts
const EXFILTRATION_PATTERNS = [
  // API keys being sent somewhere
  /send.*(?:api[_\-]?key|token|secret|password|credential)/i,
  /(?:api[_\-]?key|token|secret|password|credential).*(?:to|@|http)/i,

  // Webhook/callback with credentials
  /(?:webhook|callback|endpoint).*(?:api[_\-]?key|token|secret)/i,

  // curl/wget with credentials in URL
  /(?:curl|wget|fetch|request).*(?:api[_\-]?key|token|secret|password)/i,

  // Base64 encoding of sensitive data
  /base64.*(?:encode|encrypt).*(?:key|token|secret|password)/i,

  // Explicit exfiltration language
  /exfiltrat/i,
  /steal(?:ing)?\s+(?:the\s+)?(?:credentials?|keys?|secrets?|tokens?)/i,
  /extract(?:ing)?\s+(?:the\s+)?(?:credentials?|keys?|secrets?|tokens?)/i,
  /harvest(?:ing)?\s+(?:the\s+)?(?:credentials?|keys?|secrets?|tokens?)/i,

  // Sending to external URLs
  /https?:\/\/[^\s]+\/(?:receive|collect|log|store|save).*(?:key|token|secret)/i,
];

// Known credential patterns to detect in output
const CREDENTIAL_PATTERNS = [
  // OpenAI
  { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'OpenAI Project Key', pattern: /sk-proj-[a-zA-Z0-9]{20,}/ },

  // Anthropic
  { name: 'Anthropic API Key', pattern: /sk-ant-[a-zA-Z0-9]{20,}/ },

  // AWS
  { name: 'AWS Access Key', pattern: /AKIA[A-Z0-9]{16}/ },
  { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}/ },

  // GitHub
  { name: 'GitHub PAT', pattern: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub App Token', pattern: /ghs_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub Refresh Token', pattern: /ghr_[a-zA-Z0-9]{36}/ },

  // GitLab
  { name: 'GitLab PAT', pattern: /glpat-[a-zA-Z0-9\-_]{20}/ },

  // Slack
  { name: 'Slack Bot Token', pattern: /xoxb-[a-zA-Z0-9\-]+/ },
  { name: 'Slack User Token', pattern: /xoxp-[a-zA-Z0-9\-]+/ },
  { name: 'Slack App Token', pattern: /xapp-[a-zA-Z0-9\-]+/ },

  // Discord
  { name: 'Discord Bot Token', pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/ },

  // Google
  { name: 'Google API Key', pattern: /AIza[A-Za-z0-9_\-]{35}/ },
  { name: 'Google OAuth', pattern: /[0-9]+-[a-z0-9_]{32}\.apps\.googleusercontent\.com/ },

  // Stripe
  { name: 'Stripe Secret Key', pattern: /sk_(?:live|test)_[a-zA-Z0-9]{24,}/ },
  { name: 'Stripe Restricted Key', pattern: /rk_(?:live|test)_[a-zA-Z0-9]{24,}/ },

  // Twilio
  { name: 'Twilio API Key', pattern: /SK[a-f0-9]{32}/ },

  // SendGrid
  { name: 'SendGrid API Key', pattern: /SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}/ },

  // Mailgun
  { name: 'Mailgun API Key', pattern: /key-[a-f0-9]{32}/ },

  // Private keys
  { name: 'RSA Private Key', pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/ },
  { name: 'EC Private Key', pattern: /-----BEGIN EC PRIVATE KEY-----/ },
  { name: 'OpenSSH Private Key', pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/ },

  // Generic patterns
  { name: 'Bearer Token', pattern: /Bearer\s+[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+\.?[a-zA-Z0-9\-_=]*/ },
  { name: 'Basic Auth', pattern: /Basic\s+[A-Za-z0-9+/=]{20,}/ },
];

// Suspicious outbound targets
const SUSPICIOUS_HOSTS = [
  /webhook\.site/i,
  /requestbin/i,
  /pipedream/i,
  /ngrok/i,
  /burpcollaborator/i,
  /interact\.sh/i,
  /oast\.me/i,
  /canarytokens/i,
  /pastebin/i,
  /ghostbin/i,
  /hastebin/i,
  /transfer\.sh/i,
  /file\.io/i,
];

// Rate limiting for sensitive operations
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Default validator configuration
 */
const DEFAULT_CONFIG: OutputValidatorConfig = {
  exfiltrationPatterns: EXFILTRATION_PATTERNS.map((p) => p.source),
  blockUnknownAPIs: true,
  rateLimitSensitiveOps: true,
  maxOpsPerMinute: 10,
};

/**
 * Output Validator for Atlas
 *
 * Validates agent outputs to prevent:
 * 1. Credential exfiltration
 * 2. Suspicious outbound API calls
 * 3. Rate limit violations
 */
export class OutputValidator {
  private config: OutputValidatorConfig;
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private blockedAttempts: { timestamp: Date; reason: string; output: string }[] = [];
  private allowedHosts: Set<string> = new Set();

  constructor(config?: Partial<OutputValidatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize with common safe hosts
    this.allowedHosts.add('api.openai.com');
    this.allowedHosts.add('api.anthropic.com');
    this.allowedHosts.add('api.github.com');
    this.allowedHosts.add('api.slack.com');
    this.allowedHosts.add('discord.com');
  }

  /**
   * Validate an output before allowing it
   */
  validate(output: string): OutputValidationResult {
    const suspiciousPatterns: string[] = [];
    let riskScore = 0;

    // 1. Check for credential patterns in output
    const credentialResults = this.detectCredentials(output);
    if (credentialResults.length > 0) {
      suspiciousPatterns.push(...credentialResults.map((c) => `Credential: ${c.name}`));
      riskScore += credentialResults.length * 30;
    }

    // 2. Check for exfiltration patterns
    const exfiltrationResults = this.detectExfiltration(output);
    if (exfiltrationResults.length > 0) {
      suspiciousPatterns.push(...exfiltrationResults.map((p) => `Exfiltration: ${p}`));
      riskScore += exfiltrationResults.length * 40;
    }

    // 3. Check for suspicious hosts
    const suspiciousHosts = this.detectSuspiciousHosts(output);
    if (suspiciousHosts.length > 0) {
      suspiciousPatterns.push(...suspiciousHosts.map((h) => `Suspicious host: ${h}`));
      riskScore += suspiciousHosts.length * 25;
    }

    // 4. Check for unknown API calls if blocking is enabled
    if (this.config.blockUnknownAPIs) {
      const unknownAPIs = this.detectUnknownAPIs(output);
      if (unknownAPIs.length > 0) {
        suspiciousPatterns.push(...unknownAPIs.map((a) => `Unknown API: ${a}`));
        riskScore += unknownAPIs.length * 15;
      }
    }

    // Determine if output should be blocked
    const blocked = riskScore >= 50;
    const reason = blocked
      ? `Output blocked: Risk score ${riskScore}. Issues: ${suspiciousPatterns.join('; ')}`
      : undefined;

    // Log blocked attempts
    if (blocked) {
      this.blockedAttempts.push({
        timestamp: new Date(),
        reason: reason!,
        output: output.slice(0, 500), // Truncate for storage
      });
    }

    return {
      valid: !blocked,
      blocked,
      reason,
      suspiciousPatterns,
      riskScore: Math.min(100, riskScore),
    };
  }

  /**
   * Check rate limits for an operation
   */
  checkRateLimit(operation: string): boolean {
    if (!this.config.rateLimitSensitiveOps) {
      return true;
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const entry = this.rateLimits.get(operation);

    if (!entry || now - entry.windowStart > windowMs) {
      // Start new window
      this.rateLimits.set(operation, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.config.maxOpsPerMinute) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Detect credentials in output
   */
  private detectCredentials(output: string): { name: string; match: string }[] {
    const found: { name: string; match: string }[] = [];

    for (const cred of CREDENTIAL_PATTERNS) {
      const matches = output.match(cred.pattern);
      if (matches) {
        found.push({
          name: cred.name,
          match: `${matches[0].slice(0, 10)}...`, // Truncate for safety
        });
      }
    }

    return found;
  }

  /**
   * Detect exfiltration patterns
   */
  private detectExfiltration(output: string): string[] {
    const found: string[] = [];

    for (const pattern of EXFILTRATION_PATTERNS) {
      if (pattern.test(output)) {
        found.push(pattern.source.slice(0, 50));
      }
    }

    return found;
  }

  /**
   * Detect suspicious hosts in URLs
   */
  private detectSuspiciousHosts(output: string): string[] {
    const found: string[] = [];
    const urlPattern = /https?:\/\/([^\/\s]+)/gi;
    let match;

    while ((match = urlPattern.exec(output)) !== null) {
      const host = match[1]?.toLowerCase();
      if (host) {
        for (const suspicious of SUSPICIOUS_HOSTS) {
          if (suspicious.test(host)) {
            found.push(host);
            break;
          }
        }
      }
    }

    return found;
  }

  /**
   * Detect unknown API calls
   */
  private detectUnknownAPIs(output: string): string[] {
    const found: string[] = [];
    const urlPattern = /https?:\/\/([^\/\s]+)/gi;
    let match;

    while ((match = urlPattern.exec(output)) !== null) {
      const host = match[1]?.toLowerCase();
      if (host && !this.allowedHosts.has(host)) {
        // Check if it looks like an API call
        if (
          host.includes('api.') ||
          output.includes('fetch') ||
          output.includes('request') ||
          output.includes('curl') ||
          output.includes('POST') ||
          output.includes('GET')
        ) {
          found.push(host);
        }
      }
    }

    return found;
  }

  /**
   * Add a host to the allowed list
   */
  allowHost(host: string): void {
    this.allowedHosts.add(host.toLowerCase());
  }

  /**
   * Remove a host from the allowed list
   */
  disallowHost(host: string): void {
    this.allowedHosts.delete(host.toLowerCase());
  }

  /**
   * Get the list of allowed hosts
   */
  getAllowedHosts(): string[] {
    return Array.from(this.allowedHosts);
  }

  /**
   * Get recent blocked attempts
   */
  getBlockedAttempts(limit = 100): { timestamp: Date; reason: string; output: string }[] {
    // Trim history
    if (this.blockedAttempts.length > 1000) {
      this.blockedAttempts = this.blockedAttempts.slice(-1000);
    }
    return this.blockedAttempts.slice(-limit);
  }

  /**
   * Clear blocked attempts history
   */
  clearBlockedAttempts(): void {
    this.blockedAttempts = [];
  }

  /**
   * Get validator statistics
   */
  getStats(): {
    totalBlocked: number;
    recentBlocked: number;
    allowedHostsCount: number;
  } {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCount = this.blockedAttempts.filter(
      (a) => a.timestamp.getTime() > oneHourAgo
    ).length;

    return {
      totalBlocked: this.blockedAttempts.length,
      recentBlocked: recentCount,
      allowedHostsCount: this.allowedHosts.size,
    };
  }

  /**
   * Sanitize output by redacting credentials
   */
  redactCredentials(output: string): string {
    let redacted = output;

    for (const cred of CREDENTIAL_PATTERNS) {
      redacted = redacted.replace(cred.pattern, `[REDACTED: ${cred.name}]`);
    }

    return redacted;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OutputValidatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): OutputValidatorConfig {
    return { ...this.config };
  }
}

// Default singleton instance
let defaultValidator: OutputValidator | null = null;

export function getOutputValidator(config?: Partial<OutputValidatorConfig>): OutputValidator {
  if (!defaultValidator) {
    defaultValidator = new OutputValidator(config);
  }
  return defaultValidator;
}

export default OutputValidator;
