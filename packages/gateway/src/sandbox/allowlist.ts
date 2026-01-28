/**
 * Atlas Command Allowlist
 *
 * Implements deny-by-default command filtering with explicit allowlists.
 * Dangerous commands require human approval before execution.
 *
 * Addresses: Full shell access with no guardrails
 *
 * @module @atlas/gateway/security/sandbox/allowlist
 */

import { join, resolve, normalize, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import type {
  AllowlistConfig,
  CommandDefinition,
  DirectoryPermission,
  AllowlistDecision,
} from '@atlas/shared';

// Pre-approved safe commands that can run without approval
const SAFE_COMMANDS: CommandDefinition[] = [
  {
    name: 'ls',
    allowedArgs: '^[\\w\\s./-]*$',
    riskLevel: 'safe',
    description: 'List directory contents',
  },
  {
    name: 'cat',
    allowedArgs: '^[\\w\\s./-]+$',
    blockedArgs: '/etc/(passwd|shadow|sudoers)',
    riskLevel: 'safe',
    description: 'Display file contents',
  },
  {
    name: 'head',
    allowedArgs: '^(-n\\s*\\d+\\s+)?[\\w\\s./-]+$',
    riskLevel: 'safe',
    description: 'Display first lines of a file',
  },
  {
    name: 'tail',
    allowedArgs: '^(-n\\s*\\d+\\s+)?[\\w\\s./-]+$',
    riskLevel: 'safe',
    description: 'Display last lines of a file',
  },
  {
    name: 'grep',
    allowedArgs: '^[\\w\\s./"\'\\-*]+$',
    riskLevel: 'safe',
    description: 'Search text patterns',
  },
  {
    name: 'find',
    allowedArgs: '^[\\w\\s./-]+(\\s+-name\\s+[\\w\\s./*"\']+)?$',
    blockedArgs: '-exec|-ok',
    riskLevel: 'safe',
    description: 'Find files (no -exec)',
  },
  {
    name: 'wc',
    allowedArgs: '^[\\w\\s./-]*$',
    riskLevel: 'safe',
    description: 'Count words, lines, characters',
  },
  {
    name: 'pwd',
    riskLevel: 'safe',
    description: 'Print working directory',
  },
  {
    name: 'echo',
    riskLevel: 'safe',
    description: 'Display text',
  },
  {
    name: 'date',
    riskLevel: 'safe',
    description: 'Display date and time',
  },
  {
    name: 'whoami',
    riskLevel: 'safe',
    description: 'Display current user',
  },
  {
    name: 'basename',
    riskLevel: 'safe',
    description: 'Strip directory from filename',
  },
  {
    name: 'dirname',
    riskLevel: 'safe',
    description: 'Strip filename from path',
  },
  {
    name: 'sort',
    allowedArgs: '^[\\w\\s./-]*$',
    riskLevel: 'safe',
    description: 'Sort lines of text',
  },
  {
    name: 'uniq',
    allowedArgs: '^[\\w\\s./-]*$',
    riskLevel: 'safe',
    description: 'Filter duplicate lines',
  },
  {
    name: 'diff',
    allowedArgs: '^[\\w\\s./-]+$',
    riskLevel: 'safe',
    description: 'Compare files',
  },
  // Git commands (read-only by default)
  {
    name: 'git',
    allowedArgs: '^(status|log|diff|show|branch|remote|rev-parse|ls-files|ls-tree)',
    riskLevel: 'safe',
    description: 'Git read-only operations',
  },
];

// Commands that require explicit approval
const DANGEROUS_COMMANDS: CommandDefinition[] = [
  {
    name: 'rm',
    riskLevel: 'dangerous',
    description: 'Remove files or directories',
  },
  {
    name: 'rmdir',
    riskLevel: 'dangerous',
    description: 'Remove directories',
  },
  {
    name: 'mv',
    riskLevel: 'dangerous',
    description: 'Move or rename files',
  },
  {
    name: 'cp',
    riskLevel: 'moderate',
    description: 'Copy files',
  },
  {
    name: 'mkdir',
    riskLevel: 'moderate',
    description: 'Create directories',
  },
  {
    name: 'touch',
    riskLevel: 'moderate',
    description: 'Create or update file timestamps',
  },
  {
    name: 'chmod',
    riskLevel: 'dangerous',
    description: 'Change file permissions',
  },
  {
    name: 'chown',
    riskLevel: 'dangerous',
    description: 'Change file ownership',
  },
  {
    name: 'curl',
    riskLevel: 'dangerous',
    description: 'Transfer data from URLs',
  },
  {
    name: 'wget',
    riskLevel: 'dangerous',
    description: 'Download files from URLs',
  },
  {
    name: 'ssh',
    riskLevel: 'dangerous',
    description: 'Secure shell connection',
  },
  {
    name: 'scp',
    riskLevel: 'dangerous',
    description: 'Secure copy over SSH',
  },
  {
    name: 'rsync',
    riskLevel: 'dangerous',
    description: 'Remote file sync',
  },
  {
    name: 'tar',
    riskLevel: 'moderate',
    description: 'Archive files',
  },
  {
    name: 'unzip',
    riskLevel: 'moderate',
    description: 'Extract ZIP archives',
  },
  {
    name: 'pip',
    riskLevel: 'dangerous',
    description: 'Python package manager',
  },
  {
    name: 'npm',
    riskLevel: 'dangerous',
    description: 'Node package manager',
  },
  {
    name: 'apt',
    riskLevel: 'dangerous',
    description: 'Package manager',
  },
  {
    name: 'apt-get',
    riskLevel: 'dangerous',
    description: 'Package manager',
  },
  {
    name: 'brew',
    riskLevel: 'dangerous',
    description: 'Homebrew package manager',
  },
  // Git write commands
  {
    name: 'git',
    allowedArgs: '^(add|commit|push|pull|fetch|merge|rebase|reset|checkout|stash)',
    riskLevel: 'moderate',
    description: 'Git write operations',
  },
];

// Commands that are ALWAYS blocked
const BLOCKED_COMMANDS = [
  'sudo',
  'su',
  'passwd',
  'useradd',
  'userdel',
  'usermod',
  'groupadd',
  'groupdel',
  'groupmod',
  'visudo',
  'mount',
  'umount',
  'fdisk',
  'mkfs',
  'dd',
  'kill',
  'killall',
  'pkill',
  'shutdown',
  'reboot',
  'poweroff',
  'halt',
  'init',
  'systemctl',
  'service',
  'crontab',
  'nc', // netcat
  'ncat',
  'netcat',
  'socat',
  'eval',
  'exec',
  'source',
  '.',
];

// Patterns in arguments that are always blocked
const BLOCKED_ARG_PATTERNS = [
  /;\s*/, // Command chaining
  /\|\s*/, // Pipes (should use explicit piping)
  /`/, // Command substitution
  /\$\(/, // Command substitution
  /&&/, // Logical AND
  /\|\|/, // Logical OR
  />\s*\//, // Redirect to absolute path
  /2>&1/, // Stderr redirect
  /<\(/, // Process substitution
  />\(/, // Process substitution
];

/**
 * Default workspace configuration
 */
const DEFAULT_WORKSPACE = join(homedir(), 'atlas-workspace');

/**
 * Default allowlist configuration
 */
const DEFAULT_CONFIG: AllowlistConfig = {
  defaultPolicy: 'deny',
  safeCommands: SAFE_COMMANDS,
  dangerousCommands: DANGEROUS_COMMANDS,
  allowedDirectories: [
    {
      path: DEFAULT_WORKSPACE,
      permissions: ['read', 'write', 'execute'],
      recursive: true,
    },
    {
      path: '/tmp',
      permissions: ['read', 'write'],
      recursive: true,
    },
  ],
  blockedPatterns: [
    '**/.env',
    '**/.env.*',
    '**/credentials*',
    '**/secrets*',
    '**/*.pem',
    '**/*.key',
    '**/id_rsa*',
    '**/id_ed25519*',
    '**/.ssh/*',
    '**/.aws/*',
    '**/.kube/*',
  ],
};

/**
 * Command Allowlist Manager for Atlas
 *
 * Implements deny-by-default command filtering with explicit allowlists.
 */
export class AllowlistManager {
  private config: AllowlistConfig;
  private approvedOperations: Set<string> = new Set(); // Approved command hashes

  constructor(config?: Partial<AllowlistConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      safeCommands: [...DEFAULT_CONFIG.safeCommands, ...(config?.safeCommands ?? [])],
      dangerousCommands: [...DEFAULT_CONFIG.dangerousCommands, ...(config?.dangerousCommands ?? [])],
      allowedDirectories: config?.allowedDirectories ?? DEFAULT_CONFIG.allowedDirectories,
    };
  }

  /**
   * Check if a command is allowed
   */
  checkCommand(command: string, args: string[]): AllowlistDecision {
    // Check if command is blocked
    if (BLOCKED_COMMANDS.includes(command)) {
      return {
        allowed: false,
        reason: `Command '${command}' is blocked for security reasons`,
        requiresApproval: false,
        riskLevel: 'dangerous',
      };
    }

    // Check for blocked patterns in arguments
    const fullArgs = args.join(' ');
    for (const pattern of BLOCKED_ARG_PATTERNS) {
      if (pattern.test(fullArgs)) {
        return {
          allowed: false,
          reason: `Arguments contain blocked pattern: ${pattern.source}`,
          requiresApproval: false,
          riskLevel: 'dangerous',
        };
      }
    }

    // Check safe commands
    const safeCommand = this.config.safeCommands.find((c) => c.name === command);
    if (safeCommand) {
      // Validate arguments if pattern is specified
      if (safeCommand.allowedArgs) {
        const argsRegex = new RegExp(safeCommand.allowedArgs);
        if (!argsRegex.test(fullArgs)) {
          return {
            allowed: false,
            reason: `Arguments don't match allowed pattern for '${command}'`,
            requiresApproval: true,
            riskLevel: 'moderate',
          };
        }
      }

      // Check for blocked argument patterns
      if (safeCommand.blockedArgs) {
        const blockedRegex = new RegExp(safeCommand.blockedArgs);
        if (blockedRegex.test(fullArgs)) {
          return {
            allowed: false,
            reason: `Arguments match blocked pattern for '${command}'`,
            requiresApproval: false,
            riskLevel: 'dangerous',
          };
        }
      }

      return {
        allowed: true,
        reason: `Command '${command}' is in safe list`,
        requiresApproval: false,
        riskLevel: 'safe',
      };
    }

    // Check dangerous commands (require approval)
    const dangerousCommand = this.config.dangerousCommands.find((c) => c.name === command);
    if (dangerousCommand) {
      // Check if this specific operation was pre-approved
      const operationHash = this.hashOperation(command, args);
      if (this.approvedOperations.has(operationHash)) {
        return {
          allowed: true,
          reason: `Operation was pre-approved`,
          requiresApproval: false,
          riskLevel: dangerousCommand.riskLevel,
        };
      }

      return {
        allowed: false,
        reason: `Command '${command}' requires approval: ${dangerousCommand.description}`,
        requiresApproval: true,
        riskLevel: dangerousCommand.riskLevel,
      };
    }

    // Default deny
    return {
      allowed: false,
      reason: `Command '${command}' is not in allowlist`,
      requiresApproval: true,
      riskLevel: 'dangerous',
    };
  }

  /**
   * Check if a path is allowed
   */
  checkPath(path: string, operation: 'read' | 'write' | 'execute'): AllowlistDecision {
    // Normalize the path
    const normalizedPath = this.normalizePath(path);

    // Check blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      if (this.matchGlob(normalizedPath, pattern)) {
        return {
          allowed: false,
          reason: `Path matches blocked pattern: ${pattern}`,
          requiresApproval: false,
          riskLevel: 'dangerous',
        };
      }
    }

    // Check allowed directories
    for (const dir of this.config.allowedDirectories) {
      const normalizedDir = this.normalizePath(dir.path);

      if (normalizedPath.startsWith(normalizedDir)) {
        // Check if it's within the directory (or is the directory)
        const isExactOrChild =
          normalizedPath === normalizedDir ||
          (dir.recursive && normalizedPath.startsWith(normalizedDir + '/'));

        if (!isExactOrChild && !dir.recursive) {
          continue;
        }

        // Check permission
        if (dir.permissions.includes(operation)) {
          return {
            allowed: true,
            reason: `Path is within allowed directory: ${dir.path}`,
            requiresApproval: false,
            riskLevel: 'safe',
          };
        } else {
          return {
            allowed: false,
            reason: `Operation '${operation}' not permitted for directory: ${dir.path}`,
            requiresApproval: true,
            riskLevel: 'moderate',
          };
        }
      }
    }

    // Path not in any allowed directory
    return {
      allowed: false,
      reason: `Path is outside allowed directories: ${path}`,
      requiresApproval: true,
      riskLevel: 'dangerous',
    };
  }

  /**
   * Pre-approve a specific operation
   */
  approveOperation(command: string, args: string[]): void {
    const hash = this.hashOperation(command, args);
    this.approvedOperations.add(hash);
  }

  /**
   * Revoke approval for an operation
   */
  revokeApproval(command: string, args: string[]): void {
    const hash = this.hashOperation(command, args);
    this.approvedOperations.delete(hash);
  }

  /**
   * Clear all pre-approved operations
   */
  clearApprovals(): void {
    this.approvedOperations.clear();
  }

  /**
   * Add a command to the safe list
   */
  addSafeCommand(command: CommandDefinition): void {
    // Remove from dangerous if present
    this.config.dangerousCommands = this.config.dangerousCommands.filter(
      (c) => c.name !== command.name
    );
    this.config.safeCommands.push(command);
  }

  /**
   * Add a directory to the allowed list
   */
  addAllowedDirectory(dir: DirectoryPermission): void {
    this.config.allowedDirectories.push(dir);
  }

  /**
   * Remove a directory from the allowed list
   */
  removeAllowedDirectory(path: string): void {
    this.config.allowedDirectories = this.config.allowedDirectories.filter(
      (d) => d.path !== path
    );
  }

  /**
   * Add a blocked pattern
   */
  addBlockedPattern(pattern: string): void {
    if (!this.config.blockedPatterns.includes(pattern)) {
      this.config.blockedPatterns.push(pattern);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AllowlistConfig {
    return { ...this.config };
  }

  /**
   * Check a full command line (command + args)
   */
  checkCommandLine(commandLine: string): AllowlistDecision {
    const parts = this.parseCommandLine(commandLine);
    if (parts.length === 0) {
      return {
        allowed: false,
        reason: 'Empty command',
        requiresApproval: false,
        riskLevel: 'safe',
      };
    }

    const [command, ...args] = parts;
    return this.checkCommand(command!, args);
  }

  /**
   * Parse a command line into parts (simple tokenizer)
   */
  private parseCommandLine(line: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (const char of line) {
      if (inQuote) {
        if (char === inQuote) {
          inQuote = null;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = char;
      } else if (char === ' ' || char === '\t') {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Normalize a file path
   */
  private normalizePath(path: string): string {
    if (!isAbsolute(path)) {
      path = join(DEFAULT_WORKSPACE, path);
    }
    return normalize(resolve(path));
  }

  /**
   * Simple glob matching
   */
  private matchGlob(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Hash an operation for approval tracking
   */
  private hashOperation(command: string, args: string[]): string {
    const { createHash } = require('node:crypto');
    return createHash('sha256')
      .update(`${command}:${args.join(':')}`)
      .digest('hex');
  }
}

// Default singleton instance
let defaultManager: AllowlistManager | null = null;

export function getAllowlistManager(config?: Partial<AllowlistConfig>): AllowlistManager {
  if (!defaultManager) {
    defaultManager = new AllowlistManager(config);
  }
  return defaultManager;
}

export default AllowlistManager;
