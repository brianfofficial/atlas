/**
 * Atlas Zero-Trust Network Security
 *
 * Implements explicit IP allowlists with NO implicit localhost trust.
 * Addresses: Proxy misconfiguration bypassing localhost trust (Bitdefender, SlowMist findings)
 *
 * @module @atlas/gateway/security/network
 */

import { networkInterfaces } from 'node:os';
import { createServer, Server, IncomingMessage } from 'node:http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import type { NetworkConfig, NetworkRequest, NetworkSecurityEvent } from '@atlas/shared';

// CIDR parsing utilities
interface CIDRRange {
  network: number;
  mask: number;
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function parseCIDR(cidr: string): CIDRRange | null {
  const parts = cidr.split('/');
  if (parts.length === 1) {
    // Single IP
    return { network: ipToNumber(parts[0]!), mask: 0xffffffff };
  }
  if (parts.length !== 2) return null;

  const network = ipToNumber(parts[0]!);
  const bits = parseInt(parts[1]!, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return null;

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return { network: network & mask, mask };
}

function ipMatchesCIDR(ip: string, cidr: CIDRRange): boolean {
  const ipNum = ipToNumber(ip);
  return (ipNum & cidr.mask) === cidr.network;
}

/**
 * Default secure network configuration
 * CRITICAL: No implicit localhost trust
 */
const DEFAULT_CONFIG: NetworkConfig = {
  allowedIPs: [], // Empty by default - must be explicitly configured
  blockedIPs: [],
  allowLocalhost: false, // CRITICAL: Default false - no implicit trust
  requireVPN: false,
  port: 18789,
  bindAddress: '127.0.0.1', // Local-only by default
  tlsEnabled: false,
};

/**
 * Network Security Manager for Atlas
 *
 * Implements zero-trust networking with explicit allowlists.
 * NO implicit localhost trust - this prevents proxy misconfiguration attacks.
 */
export class NetworkSecurityManager {
  private config: NetworkConfig;
  private parsedAllowedIPs: CIDRRange[] = [];
  private parsedBlockedIPs: CIDRRange[] = [];
  private securityEvents: NetworkSecurityEvent[] = [];
  private requestLog: NetworkRequest[] = [];
  private rateLimitMap: Map<string, number[]> = new Map();

  // Rate limiting config
  private readonly rateLimitWindow = 60 * 1000; // 1 minute
  private readonly rateLimitMax = 100; // 100 requests per minute

  constructor(config?: Partial<NetworkConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parseIPRanges();
    this.validateConfiguration();
  }

  /**
   * Parse IP ranges from configuration
   */
  private parseIPRanges(): void {
    this.parsedAllowedIPs = this.config.allowedIPs
      .map(parseCIDR)
      .filter((r): r is CIDRRange => r !== null);

    this.parsedBlockedIPs = this.config.blockedIPs
      .map(parseCIDR)
      .filter((r): r is CIDRRange => r !== null);
  }

  /**
   * Validate configuration and warn about dangerous settings
   */
  private validateConfiguration(): void {
    const warnings: string[] = [];

    // Check for public exposure
    if (this.config.bindAddress === '0.0.0.0') {
      warnings.push(
        'DANGER: bindAddress is 0.0.0.0 - gateway is exposed to all networks!'
      );
      this.emitSecurityEvent({
        type: 'public_exposure_detected',
        details: 'Gateway configured to bind to all interfaces (0.0.0.0)',
      });
    }

    // Check for localhost trust (should be disabled)
    if (this.config.allowLocalhost) {
      warnings.push(
        'WARNING: allowLocalhost is enabled - this can be bypassed via reverse proxy misconfiguration!'
      );
    }

    // Check for empty allowlist with public binding
    if (this.config.bindAddress !== '127.0.0.1' && this.config.allowedIPs.length === 0) {
      warnings.push(
        'DANGER: No IP allowlist configured with public binding - gateway accepts all connections!'
      );
      this.emitSecurityEvent({
        type: 'public_exposure_detected',
        details: 'No IP allowlist configured',
      });
    }

    // Check for TLS on public binding
    if (this.config.bindAddress !== '127.0.0.1' && !this.config.tlsEnabled) {
      warnings.push(
        'WARNING: TLS is disabled on public binding - traffic is unencrypted!'
      );
    }

    // Print warnings to stderr
    for (const warning of warnings) {
      console.error(`[Atlas Network Security] ${warning}`);
    }
  }

  /**
   * Check if an IP address is allowed
   */
  isIPAllowed(ip: string): boolean {
    // Normalize IPv6-mapped IPv4 addresses
    const normalizedIP = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

    // Check blocked list first
    if (this.parsedBlockedIPs.some((cidr) => ipMatchesCIDR(normalizedIP, cidr))) {
      this.emitSecurityEvent({
        type: 'blocked_ip',
        ip: normalizedIP,
        reason: 'IP is in blocklist',
      });
      return false;
    }

    // Check if localhost (only if explicitly allowed - NOT by default)
    const isLocalhost =
      normalizedIP === '127.0.0.1' ||
      normalizedIP === 'localhost' ||
      normalizedIP === '::1';

    if (isLocalhost) {
      // CRITICAL: Localhost is NOT automatically trusted
      // This prevents reverse proxy bypass attacks
      if (!this.config.allowLocalhost) {
        this.emitSecurityEvent({
          type: 'blocked_ip',
          ip: normalizedIP,
          reason: 'Localhost access not explicitly allowed (zero-trust)',
        });
        return false;
      }
      return true;
    }

    // Check allowlist
    if (this.parsedAllowedIPs.length === 0) {
      // No allowlist = deny all (unless binding to localhost only)
      if (this.config.bindAddress === '127.0.0.1') {
        // If we're only listening on localhost, this shouldn't happen
        // but allow it since the socket binding provides protection
        return true;
      }
      this.emitSecurityEvent({
        type: 'blocked_ip',
        ip: normalizedIP,
        reason: 'No allowlist configured and IP is not in any allowed range',
      });
      return false;
    }

    const allowed = this.parsedAllowedIPs.some((cidr) => ipMatchesCIDR(normalizedIP, cidr));
    if (!allowed) {
      this.emitSecurityEvent({
        type: 'blocked_ip',
        ip: normalizedIP,
        reason: 'IP not in allowlist',
      });
    }
    return allowed;
  }

  /**
   * Check rate limiting for an IP
   */
  checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const requests = this.rateLimitMap.get(ip) ?? [];

    // Remove old requests outside the window
    const recentRequests = requests.filter((t) => now - t < this.rateLimitWindow);

    if (recentRequests.length >= this.rateLimitMax) {
      this.emitSecurityEvent({
        type: 'rate_limit_exceeded',
        ip,
      });
      return false;
    }

    recentRequests.push(now);
    this.rateLimitMap.set(ip, recentRequests);
    return true;
  }

  /**
   * Process an incoming request
   */
  processRequest(req: IncomingMessage): { allowed: boolean; reason?: string } {
    // Get the real IP (handle X-Forwarded-For with caution)
    const ip = this.getClientIP(req);

    // Log the request
    const request: NetworkRequest = {
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date(),
      path: req.url ?? '/',
      method: req.method ?? 'GET',
      authenticated: false, // Will be set by auth middleware
    };
    this.requestLog.push(request);

    // Trim request log to last 1000 entries
    if (this.requestLog.length > 1000) {
      this.requestLog = this.requestLog.slice(-1000);
    }

    // Check IP allowlist
    if (!this.isIPAllowed(ip)) {
      return { allowed: false, reason: 'IP not allowed' };
    }

    // Check rate limiting
    if (!this.checkRateLimit(ip)) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }

    return { allowed: true };
  }

  /**
   * Get the client IP from a request
   * WARNING: X-Forwarded-For can be spoofed - only trust it from known proxies
   */
  private getClientIP(req: IncomingMessage): string {
    // If we're binding to localhost only, trust the socket IP
    if (this.config.bindAddress === '127.0.0.1') {
      return req.socket.remoteAddress ?? '127.0.0.1';
    }

    // For public-facing servers, be very careful with X-Forwarded-For
    // Only use socket address by default for security
    // A real deployment would configure trusted proxy IPs
    return req.socket.remoteAddress ?? 'unknown';
  }

  /**
   * Detect if the gateway is publicly exposed
   */
  async detectPublicExposure(): Promise<boolean> {
    // Check if any interface is bound to a public IP
    const interfaces = networkInterfaces();
    const publicIPs: string[] = [];

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const addr of iface) {
          if (!addr.internal && addr.family === 'IPv4') {
            // Check if it's a private IP
            const ip = addr.address;
            const isPrivate =
              ip.startsWith('10.') ||
              ip.startsWith('192.168.') ||
              ip.match(/^172\.(1[6-9]|2[0-9]|3[01])\./) ||
              ip === '127.0.0.1';

            if (!isPrivate) {
              publicIPs.push(ip);
            }
          }
        }
      }
    }

    // Check binding configuration
    const isPubliclyBound =
      this.config.bindAddress === '0.0.0.0' ||
      publicIPs.includes(this.config.bindAddress);

    if (isPubliclyBound) {
      this.emitSecurityEvent({
        type: 'public_exposure_detected',
        details: `Gateway may be publicly accessible. Public IPs: ${publicIPs.join(', ')}`,
      });
      return true;
    }

    return false;
  }

  /**
   * Create an HTTP/HTTPS server with security middleware
   */
  async createSecureServer(
    requestHandler: (req: IncomingMessage, res: any) => void
  ): Promise<Server | HttpsServer> {
    // Check for public exposure on startup
    const isExposed = await this.detectPublicExposure();
    if (isExposed && !this.config.tlsEnabled) {
      console.error(
        '[Atlas] CRITICAL: Gateway appears to be publicly exposed without TLS!'
      );
      console.error('[Atlas] This is a security risk. Enable TLS or bind to 127.0.0.1.');
    }

    // Create the server with security middleware
    const secureHandler = (req: IncomingMessage, res: any) => {
      const result = this.processRequest(req);

      if (!result.allowed) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Access denied', reason: result.reason }));
        return;
      }

      requestHandler(req, res);
    };

    if (this.config.tlsEnabled && this.config.tlsCertPath && this.config.tlsKeyPath) {
      const [cert, key] = await Promise.all([
        readFile(this.config.tlsCertPath),
        readFile(this.config.tlsKeyPath),
      ]);

      return createHttpsServer({ cert, key }, secureHandler);
    }

    return createServer(secureHandler);
  }

  /**
   * Emit a security event
   */
  private emitSecurityEvent(event: NetworkSecurityEvent): void {
    this.securityEvents.push(event);

    // Trim to last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log security events
    console.warn(`[Atlas Security] ${event.type}:`, event);
  }

  /**
   * Get recent security events
   */
  getSecurityEvents(limit = 100): NetworkSecurityEvent[] {
    return this.securityEvents.slice(-limit);
  }

  /**
   * Get recent request log
   */
  getRequestLog(limit = 100): NetworkRequest[] {
    return this.requestLog.slice(-limit);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...config };
    this.parseIPRanges();
    this.validateConfiguration();
  }

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): NetworkConfig {
    return { ...this.config };
  }

  /**
   * Get network statistics
   */
  getStats(): {
    totalRequests: number;
    blockedRequests: number;
    uniqueIPs: number;
    securityEvents: number;
  } {
    const uniqueIPs = new Set(this.requestLog.map((r) => r.ipAddress)).size;
    const blockedCount = this.securityEvents.filter(
      (e) => e.type === 'blocked_ip' || e.type === 'rate_limit_exceeded'
    ).length;

    return {
      totalRequests: this.requestLog.length,
      blockedRequests: blockedCount,
      uniqueIPs,
      securityEvents: this.securityEvents.length,
    };
  }

  /**
   * Add an IP to the allowlist at runtime
   */
  allowIP(ip: string): void {
    if (!this.config.allowedIPs.includes(ip)) {
      this.config.allowedIPs.push(ip);
      const parsed = parseCIDR(ip);
      if (parsed) {
        this.parsedAllowedIPs.push(parsed);
      }
    }
  }

  /**
   * Block an IP at runtime
   */
  blockIP(ip: string): void {
    if (!this.config.blockedIPs.includes(ip)) {
      this.config.blockedIPs.push(ip);
      const parsed = parseCIDR(ip);
      if (parsed) {
        this.parsedBlockedIPs.push(parsed);
      }
    }
  }
}

// Default singleton instance
let defaultManager: NetworkSecurityManager | null = null;

export function getNetworkSecurityManager(config?: Partial<NetworkConfig>): NetworkSecurityManager {
  if (!defaultManager) {
    defaultManager = new NetworkSecurityManager(config);
  }
  return defaultManager;
}

export default NetworkSecurityManager;
