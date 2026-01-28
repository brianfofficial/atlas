/**
 * Atlas - Vulnerability Scanner
 *
 * Scans skill dependencies for known CVEs and security issues.
 * Similar to npm audit but for Atlas skills.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  VulnerabilityScanResult,
  VulnerabilityInfo,
  SkillManifest,
} from './types.js'

/**
 * Severity score thresholds (CVSS)
 */
const SEVERITY_THRESHOLDS = {
  critical: 9.0,
  high: 7.0,
  medium: 4.0,
  low: 0.1,
}

/**
 * Known vulnerability database (simplified)
 * In production, this would fetch from a real vulnerability database
 */
const VULNERABILITY_DATABASE: VulnerabilityInfo[] = [
  {
    cve: 'CVE-2024-0001',
    package: 'unsafe-package',
    affectedVersions: '<1.2.0',
    severity: 9.8,
    description: 'Remote code execution vulnerability in unsafe-package',
    fixAvailable: true,
    fixedIn: '1.2.0',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-0001'],
  },
  {
    cve: 'CVE-2024-0002',
    package: 'vulnerable-lib',
    affectedVersions: '>=2.0.0 <2.3.1',
    severity: 7.5,
    description: 'SQL injection vulnerability in vulnerable-lib',
    fixAvailable: true,
    fixedIn: '2.3.1',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-0002'],
  },
  {
    cve: 'CVE-2024-0003',
    package: 'risky-module',
    affectedVersions: '*',
    severity: 5.0,
    description: 'Denial of service vulnerability in risky-module',
    fixAvailable: false,
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-0003'],
  },
]

/**
 * Scan a skill for vulnerabilities
 */
export async function scanSkill(skillPath: string): Promise<VulnerabilityScanResult> {
  const result: VulnerabilityScanResult = {
    totalVulnerabilities: 0,
    bySeverity: {
      critical: [],
      high: [],
      medium: [],
      low: [],
    },
    scannedAt: new Date(),
    success: true,
  }

  try {
    // Load package.json if it exists
    const packageJsonPath = path.join(skillPath, 'package.json')
    let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8')
      packageJson = JSON.parse(content)
    } catch {
      // No package.json - check manifest for dependencies
      const manifestPath = path.join(skillPath, 'atlas-skill.json')
      try {
        const content = await fs.readFile(manifestPath, 'utf-8')
        const manifest = JSON.parse(content) as SkillManifest
        packageJson = { dependencies: manifest.dependencies }
      } catch {
        // No dependencies to scan
        return result
      }
    }

    // Get all dependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    // Check each dependency against vulnerability database
    for (const [pkgName, version] of Object.entries(allDeps)) {
      const vulns = findVulnerabilities(pkgName, version)

      for (const vuln of vulns) {
        result.totalVulnerabilities++

        if (vuln.severity >= SEVERITY_THRESHOLDS.critical) {
          result.bySeverity.critical.push(vuln)
        } else if (vuln.severity >= SEVERITY_THRESHOLDS.high) {
          result.bySeverity.high.push(vuln)
        } else if (vuln.severity >= SEVERITY_THRESHOLDS.medium) {
          result.bySeverity.medium.push(vuln)
        } else {
          result.bySeverity.low.push(vuln)
        }
      }
    }

    // Also scan node_modules if present
    const nodeModulesPath = path.join(skillPath, 'node_modules')
    try {
      await fs.access(nodeModulesPath)
      const nodeModulesResult = await scanNodeModules(nodeModulesPath)
      mergeResults(result, nodeModulesResult)
    } catch {
      // No node_modules directory
    }

    return result
  } catch (error) {
    return {
      ...result,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during scan',
    }
  }
}

/**
 * Find vulnerabilities for a specific package
 */
function findVulnerabilities(packageName: string, version: string): VulnerabilityInfo[] {
  return VULNERABILITY_DATABASE.filter((vuln) => {
    if (vuln.package !== packageName) {
      return false
    }

    // Check if version matches affected range
    return isVersionAffected(version, vuln.affectedVersions)
  })
}

/**
 * Check if a version is affected by a vulnerability range
 */
function isVersionAffected(version: string, affectedRange: string): boolean {
  // Remove semver prefix characters
  const cleanVersion = version.replace(/^[\^~>=<]+/, '')

  // Handle wildcard
  if (affectedRange === '*') {
    return true
  }

  // Parse range conditions
  const conditions = affectedRange.split(' ')

  for (const condition of conditions) {
    if (condition.startsWith('>=')) {
      if (!isVersionGte(cleanVersion, condition.slice(2))) {
        return false
      }
    } else if (condition.startsWith('>')) {
      if (!isVersionGt(cleanVersion, condition.slice(1))) {
        return false
      }
    } else if (condition.startsWith('<=')) {
      if (!isVersionLte(cleanVersion, condition.slice(2))) {
        return false
      }
    } else if (condition.startsWith('<')) {
      if (!isVersionLt(cleanVersion, condition.slice(1))) {
        return false
      }
    } else if (condition.startsWith('=')) {
      if (cleanVersion !== condition.slice(1)) {
        return false
      }
    }
  }

  return true
}

/**
 * Version comparison helpers
 */
function parseVersion(v: string): number[] {
  return v.split('.').map((n) => parseInt(n, 10) || 0)
}

function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a)
  const bParts = parseVersion(b)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0
    const bPart = bParts[i] || 0

    if (aPart > bPart) return 1
    if (aPart < bPart) return -1
  }

  return 0
}

function isVersionGte(a: string, b: string): boolean {
  return compareVersions(a, b) >= 0
}

function isVersionGt(a: string, b: string): boolean {
  return compareVersions(a, b) > 0
}

function isVersionLte(a: string, b: string): boolean {
  return compareVersions(a, b) <= 0
}

function isVersionLt(a: string, b: string): boolean {
  return compareVersions(a, b) < 0
}

/**
 * Scan node_modules directory recursively
 */
async function scanNodeModules(nodeModulesPath: string): Promise<VulnerabilityScanResult> {
  const result: VulnerabilityScanResult = {
    totalVulnerabilities: 0,
    bySeverity: {
      critical: [],
      high: [],
      medium: [],
      low: [],
    },
    scannedAt: new Date(),
    success: true,
  }

  try {
    const entries = await fs.readdir(nodeModulesPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue
      }

      const pkgPath = path.join(nodeModulesPath, entry.name)

      // Handle scoped packages
      if (entry.name.startsWith('@')) {
        const scopedEntries = await fs.readdir(pkgPath, { withFileTypes: true })
        for (const scopedEntry of scopedEntries) {
          if (scopedEntry.isDirectory()) {
            await scanPackage(path.join(pkgPath, scopedEntry.name), result)
          }
        }
      } else {
        await scanPackage(pkgPath, result)
      }
    }
  } catch (error) {
    result.success = false
    result.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return result
}

/**
 * Scan a single package
 */
async function scanPackage(pkgPath: string, result: VulnerabilityScanResult): Promise<void> {
  try {
    const packageJsonPath = path.join(pkgPath, 'package.json')
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(content)

    const { name, version } = packageJson
    if (!name || !version) return

    const vulns = findVulnerabilities(name, version)

    for (const vuln of vulns) {
      result.totalVulnerabilities++

      if (vuln.severity >= SEVERITY_THRESHOLDS.critical) {
        result.bySeverity.critical.push(vuln)
      } else if (vuln.severity >= SEVERITY_THRESHOLDS.high) {
        result.bySeverity.high.push(vuln)
      } else if (vuln.severity >= SEVERITY_THRESHOLDS.medium) {
        result.bySeverity.medium.push(vuln)
      } else {
        result.bySeverity.low.push(vuln)
      }
    }
  } catch {
    // Skip packages without valid package.json
  }
}

/**
 * Merge two scan results
 */
function mergeResults(target: VulnerabilityScanResult, source: VulnerabilityScanResult): void {
  target.totalVulnerabilities += source.totalVulnerabilities
  target.bySeverity.critical.push(...source.bySeverity.critical)
  target.bySeverity.high.push(...source.bySeverity.high)
  target.bySeverity.medium.push(...source.bySeverity.medium)
  target.bySeverity.low.push(...source.bySeverity.low)

  if (!source.success) {
    target.success = false
    target.error = source.error
  }
}

/**
 * Format scan result for display
 */
export function formatScanResult(result: VulnerabilityScanResult): string {
  const lines: string[] = []

  lines.push(`Vulnerability Scan Results`)
  lines.push(`========================`)
  lines.push(`Scanned at: ${result.scannedAt.toISOString()}`)
  lines.push(`Total vulnerabilities: ${result.totalVulnerabilities}`)
  lines.push('')

  if (result.bySeverity.critical.length > 0) {
    lines.push(`CRITICAL (${result.bySeverity.critical.length}):`)
    for (const vuln of result.bySeverity.critical) {
      lines.push(`  - ${vuln.cve}: ${vuln.package} (${vuln.affectedVersions})`)
      lines.push(`    ${vuln.description}`)
      if (vuln.fixAvailable) {
        lines.push(`    Fix: upgrade to ${vuln.fixedIn}`)
      }
    }
    lines.push('')
  }

  if (result.bySeverity.high.length > 0) {
    lines.push(`HIGH (${result.bySeverity.high.length}):`)
    for (const vuln of result.bySeverity.high) {
      lines.push(`  - ${vuln.cve}: ${vuln.package} (${vuln.affectedVersions})`)
      lines.push(`    ${vuln.description}`)
      if (vuln.fixAvailable) {
        lines.push(`    Fix: upgrade to ${vuln.fixedIn}`)
      }
    }
    lines.push('')
  }

  if (result.bySeverity.medium.length > 0) {
    lines.push(`MEDIUM (${result.bySeverity.medium.length}):`)
    for (const vuln of result.bySeverity.medium) {
      lines.push(`  - ${vuln.cve}: ${vuln.package}`)
    }
    lines.push('')
  }

  if (result.bySeverity.low.length > 0) {
    lines.push(`LOW (${result.bySeverity.low.length}):`)
    for (const vuln of result.bySeverity.low) {
      lines.push(`  - ${vuln.cve}: ${vuln.package}`)
    }
  }

  if (result.totalVulnerabilities === 0) {
    lines.push('No vulnerabilities found!')
  }

  return lines.join('\n')
}

/**
 * Check if scan result passes security requirements
 */
export function checkScanResult(
  result: VulnerabilityScanResult,
  maxAllowed: { critical: number; high: number; medium: number; low: number } = {
    critical: 0,
    high: 0,
    medium: 5,
    low: 10,
  }
): { passed: boolean; reason?: string } {
  if (result.bySeverity.critical.length > maxAllowed.critical) {
    return {
      passed: false,
      reason: `Found ${result.bySeverity.critical.length} critical vulnerabilities (max allowed: ${maxAllowed.critical})`,
    }
  }

  if (result.bySeverity.high.length > maxAllowed.high) {
    return {
      passed: false,
      reason: `Found ${result.bySeverity.high.length} high severity vulnerabilities (max allowed: ${maxAllowed.high})`,
    }
  }

  if (result.bySeverity.medium.length > maxAllowed.medium) {
    return {
      passed: false,
      reason: `Found ${result.bySeverity.medium.length} medium severity vulnerabilities (max allowed: ${maxAllowed.medium})`,
    }
  }

  if (result.bySeverity.low.length > maxAllowed.low) {
    return {
      passed: false,
      reason: `Found ${result.bySeverity.low.length} low severity vulnerabilities (max allowed: ${maxAllowed.low})`,
    }
  }

  return { passed: true }
}
