/**
 * Atlas - Skill Manifest
 *
 * Handles parsing, validation, and permission checking for skill manifests.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  SkillManifest,
  SkillPermissions,
  SkillIssue,
  SkillRiskLevel,
} from './types.js'

/**
 * Required fields in a skill manifest
 */
const REQUIRED_FIELDS = ['id', 'name', 'version', 'description', 'author', 'license', 'atlasVersion', 'main']

/**
 * Maximum permission thresholds before escalating risk level
 */
const PERMISSION_THRESHOLDS = {
  filesystemRead: 10,
  filesystemWrite: 5,
  networkHosts: 5,
  shellCommands: 3,
}

/**
 * High-risk permission patterns
 */
const HIGH_RISK_PATTERNS = {
  filesystemRead: [
    /^\/etc\//,
    /^\/usr\//,
    /^\/var\//,
    /\.ssh\//,
    /\.aws\//,
    /\.env/,
    /credentials/i,
    /secret/i,
    /password/i,
  ],
  filesystemWrite: [
    /^\/etc\//,
    /^\/usr\//,
    /^\/bin\//,
    /^\/sbin\//,
    /^~\/\./,  // Hidden files in home
    /\.bashrc/,
    /\.zshrc/,
    /\.profile/,
  ],
  networkHosts: [
    /webhook\.site/,
    /ngrok\.io/,
    /burpcollaborator/,
    /interact\.sh/,
    /oast\./,
  ],
  shellCommands: [
    /^sudo/,
    /^su /,
    /^rm -rf/,
    /^chmod 777/,
    /curl.*\|.*sh/,
    /wget.*\|.*sh/,
    /eval/,
    /exec/,
  ],
}

/**
 * Parse a skill manifest from a JSON file
 */
export async function parseManifest(manifestPath: string): Promise<SkillManifest> {
  const content = await fs.readFile(manifestPath, 'utf-8')
  return JSON.parse(content) as SkillManifest
}

/**
 * Validate a skill manifest for required fields and format
 */
export function validateManifest(manifest: SkillManifest): SkillIssue[] {
  const issues: SkillIssue[] = []

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in manifest) || manifest[field as keyof SkillManifest] === undefined) {
      issues.push({
        severity: 'error',
        code: 'MISSING_REQUIRED_FIELD',
        message: `Missing required field: ${field}`,
        suggestion: `Add the "${field}" field to your manifest`,
      })
    }
  }

  // Validate ID format
  if (manifest.id && !/^[a-z0-9-]+$/.test(manifest.id)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_ID_FORMAT',
      message: 'Skill ID must contain only lowercase letters, numbers, and hyphens',
      suggestion: 'Use a valid ID like "my-skill-name"',
    })
  }

  // Validate version format (semver)
  if (manifest.version && !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(manifest.version)) {
    issues.push({
      severity: 'warning',
      code: 'INVALID_VERSION_FORMAT',
      message: 'Version should follow semantic versioning (e.g., 1.0.0)',
      suggestion: 'Use semver format: MAJOR.MINOR.PATCH',
    })
  }

  // Validate author
  if (manifest.author) {
    if (!manifest.author.name) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_AUTHOR_NAME',
        message: 'Author name is recommended',
        suggestion: 'Add author.name to your manifest',
      })
    }
  }

  // Validate license
  if (manifest.license && !isValidSPDX(manifest.license)) {
    issues.push({
      severity: 'info',
      code: 'UNKNOWN_LICENSE',
      message: `License "${manifest.license}" is not a recognized SPDX identifier`,
      suggestion: 'Use a standard SPDX license identifier (e.g., MIT, Apache-2.0)',
    })
  }

  // Validate main entry point
  if (manifest.main && !manifest.main.endsWith('.js') && !manifest.main.endsWith('.ts')) {
    issues.push({
      severity: 'warning',
      code: 'UNEXPECTED_ENTRY_POINT',
      message: 'Entry point should be a JavaScript or TypeScript file',
      suggestion: 'Use a .js or .ts file as the main entry point',
    })
  }

  return issues
}

/**
 * Analyze permissions and calculate risk level
 */
export function analyzePermissions(
  permissions: SkillPermissions
): { riskLevel: SkillRiskLevel; issues: SkillIssue[] } {
  const issues: SkillIssue[] = []
  let maxRisk: SkillRiskLevel = 'low'

  const elevateRisk = (level: SkillRiskLevel) => {
    const levels: SkillRiskLevel[] = ['low', 'medium', 'high', 'critical']
    if (levels.indexOf(level) > levels.indexOf(maxRisk)) {
      maxRisk = level
    }
  }

  // Check filesystem read permissions
  if (permissions.filesystemRead) {
    if (permissions.filesystemRead.length > PERMISSION_THRESHOLDS.filesystemRead) {
      issues.push({
        severity: 'warning',
        code: 'EXCESSIVE_READ_PERMISSIONS',
        message: `Skill requests read access to ${permissions.filesystemRead.length} paths`,
        suggestion: 'Limit file access to only necessary paths',
      })
      elevateRisk('medium')
    }

    for (const path of permissions.filesystemRead) {
      for (const pattern of HIGH_RISK_PATTERNS.filesystemRead) {
        if (pattern.test(path)) {
          issues.push({
            severity: 'error',
            code: 'HIGH_RISK_READ_PATH',
            message: `High-risk read path detected: ${path}`,
            suggestion: 'Avoid accessing sensitive system paths',
          })
          elevateRisk('high')
        }
      }
    }
  }

  // Check filesystem write permissions
  if (permissions.filesystemWrite) {
    if (permissions.filesystemWrite.length > PERMISSION_THRESHOLDS.filesystemWrite) {
      issues.push({
        severity: 'warning',
        code: 'EXCESSIVE_WRITE_PERMISSIONS',
        message: `Skill requests write access to ${permissions.filesystemWrite.length} paths`,
        suggestion: 'Limit write access to only necessary paths',
      })
      elevateRisk('medium')
    }

    for (const path of permissions.filesystemWrite) {
      for (const pattern of HIGH_RISK_PATTERNS.filesystemWrite) {
        if (pattern.test(path)) {
          issues.push({
            severity: 'error',
            code: 'HIGH_RISK_WRITE_PATH',
            message: `High-risk write path detected: ${path}`,
            suggestion: 'Avoid writing to sensitive system paths',
          })
          elevateRisk('critical')
        }
      }
    }
  }

  // Check network permissions
  if (permissions.networkHosts) {
    for (const host of permissions.networkHosts) {
      for (const pattern of HIGH_RISK_PATTERNS.networkHosts) {
        if (pattern.test(host)) {
          issues.push({
            severity: 'error',
            code: 'SUSPICIOUS_NETWORK_HOST',
            message: `Suspicious network host detected: ${host}`,
            suggestion: 'Remove access to known exfiltration endpoints',
          })
          elevateRisk('critical')
        }
      }
    }

    if (permissions.networkHosts.includes('*')) {
      issues.push({
        severity: 'error',
        code: 'WILDCARD_NETWORK_ACCESS',
        message: 'Skill requests access to all network hosts',
        suggestion: 'Specify only the necessary hosts',
      })
      elevateRisk('high')
    }
  }

  // Check shell command permissions
  if (permissions.shellCommands) {
    if (permissions.shellCommands.length > PERMISSION_THRESHOLDS.shellCommands) {
      issues.push({
        severity: 'warning',
        code: 'EXCESSIVE_SHELL_PERMISSIONS',
        message: `Skill requests ${permissions.shellCommands.length} shell commands`,
        suggestion: 'Limit shell access to only necessary commands',
      })
      elevateRisk('medium')
    }

    for (const cmd of permissions.shellCommands) {
      for (const pattern of HIGH_RISK_PATTERNS.shellCommands) {
        if (pattern.test(cmd)) {
          issues.push({
            severity: 'error',
            code: 'DANGEROUS_SHELL_COMMAND',
            message: `Dangerous shell command pattern detected: ${cmd}`,
            suggestion: 'Remove dangerous command patterns',
          })
          elevateRisk('critical')
        }
      }
    }
  }

  // Check credential access
  if (permissions.credentialServices && permissions.credentialServices.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'CREDENTIAL_ACCESS',
      message: `Skill requests access to credentials: ${permissions.credentialServices.join(', ')}`,
      suggestion: 'Ensure credential access is necessary',
    })
    elevateRisk('high')
  }

  return { riskLevel: maxRisk, issues }
}

/**
 * Check if permissions are within allowed bounds
 */
export function checkPermissionBounds(
  permissions: SkillPermissions,
  allowedPermissions: SkillPermissions
): SkillIssue[] {
  const issues: SkillIssue[] = []

  // Check filesystem read
  if (permissions.filesystemRead && allowedPermissions.filesystemRead) {
    for (const requestedPath of permissions.filesystemRead) {
      const isAllowed = allowedPermissions.filesystemRead.some(
        (allowed) => requestedPath.startsWith(allowed) || minimatch(requestedPath, allowed)
      )
      if (!isAllowed) {
        issues.push({
          severity: 'error',
          code: 'PERMISSION_DENIED',
          message: `Read access to "${requestedPath}" not allowed`,
        })
      }
    }
  }

  // Check filesystem write
  if (permissions.filesystemWrite && allowedPermissions.filesystemWrite) {
    for (const requestedPath of permissions.filesystemWrite) {
      const isAllowed = allowedPermissions.filesystemWrite.some(
        (allowed) => requestedPath.startsWith(allowed) || minimatch(requestedPath, allowed)
      )
      if (!isAllowed) {
        issues.push({
          severity: 'error',
          code: 'PERMISSION_DENIED',
          message: `Write access to "${requestedPath}" not allowed`,
        })
      }
    }
  }

  // Check network hosts
  if (permissions.networkHosts && allowedPermissions.networkHosts) {
    for (const host of permissions.networkHosts) {
      const isAllowed = allowedPermissions.networkHosts.some(
        (allowed) => host === allowed || (allowed.startsWith('*.') && host.endsWith(allowed.slice(1)))
      )
      if (!isAllowed) {
        issues.push({
          severity: 'error',
          code: 'PERMISSION_DENIED',
          message: `Network access to "${host}" not allowed`,
        })
      }
    }
  }

  // Check shell commands
  if (permissions.shellCommands && allowedPermissions.shellCommands) {
    for (const cmd of permissions.shellCommands) {
      const isAllowed = allowedPermissions.shellCommands.some(
        (allowed) => cmd === allowed || cmd.startsWith(allowed + ' ')
      )
      if (!isAllowed) {
        issues.push({
          severity: 'error',
          code: 'PERMISSION_DENIED',
          message: `Shell command "${cmd}" not allowed`,
        })
      }
    }
  }

  return issues
}

/**
 * Simple minimatch implementation for basic glob patterns
 */
function minimatch(str: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$'
  )
  return regex.test(str)
}

/**
 * Check if a license is a valid SPDX identifier
 */
function isValidSPDX(license: string): boolean {
  const commonLicenses = [
    'MIT',
    'Apache-2.0',
    'GPL-3.0',
    'GPL-2.0',
    'BSD-3-Clause',
    'BSD-2-Clause',
    'ISC',
    'MPL-2.0',
    'LGPL-3.0',
    'Unlicense',
    'CC0-1.0',
    'WTFPL',
  ]
  return commonLicenses.includes(license) || license.startsWith('SEE LICENSE')
}

/**
 * Generate a default manifest template
 */
export function generateManifestTemplate(skillId: string): SkillManifest {
  return {
    id: skillId,
    name: skillId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    version: '1.0.0',
    description: 'A skill for Atlas',
    author: {
      name: 'Your Name',
      email: 'your.email@example.com',
    },
    license: 'MIT',
    atlasVersion: '>=0.1.0',
    permissions: {
      filesystemRead: ['~/atlas-workspace'],
      filesystemWrite: [],
      networkHosts: [],
      shellCommands: [],
    },
    main: 'index.js',
  }
}
