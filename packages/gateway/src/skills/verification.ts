/**
 * Atlas - Skill Verification
 *
 * Cryptographic verification of skill integrity and authenticity.
 * Uses Ed25519 signatures to prevent supply chain attacks.
 */

import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  SkillManifest,
  SkillVerificationResult,
  SkillIssue,
  SkillRiskLevel,
} from './types.js'
import { validateManifest, analyzePermissions } from './manifest.js'

/**
 * Trusted public keys for signed skills
 * In production, this would be loaded from a secure configuration
 */
const TRUSTED_PUBLIC_KEYS = new Map<string, string>([
  // Atlas official key (example)
  ['atlas-official', 'MCowBQYDK2VwAyEAexample_public_key_here'],
])

/**
 * Verification options
 */
export interface VerificationOptions {
  /** Require a valid signature */
  requireSignature: boolean

  /** Allow only trusted publishers */
  trustedPublishersOnly: boolean

  /** Maximum allowed risk level */
  maxRiskLevel: SkillRiskLevel

  /** Skip code hash verification (for development) */
  skipCodeHash: boolean
}

/**
 * Default verification options (strict)
 */
export const DEFAULT_VERIFICATION_OPTIONS: VerificationOptions = {
  requireSignature: true,
  trustedPublishersOnly: true,
  maxRiskLevel: 'medium',
  skipCodeHash: false,
}

/**
 * Verify a skill's integrity and authenticity
 */
export async function verifySkill(
  skillPath: string,
  options: Partial<VerificationOptions> = {}
): Promise<SkillVerificationResult> {
  const opts = { ...DEFAULT_VERIFICATION_OPTIONS, ...options }
  const issues: SkillIssue[] = []
  const warnings: string[] = []

  // Load manifest
  const manifestPath = path.join(skillPath, 'atlas-skill.json')
  let manifest: SkillManifest

  try {
    const content = await fs.readFile(manifestPath, 'utf-8')
    manifest = JSON.parse(content) as SkillManifest
  } catch (error) {
    return {
      isValid: false,
      riskLevel: 'critical',
      issues: [
        {
          severity: 'error',
          code: 'MANIFEST_NOT_FOUND',
          message: 'Could not read atlas-skill.json manifest',
          suggestion: 'Ensure the skill has a valid atlas-skill.json file',
        },
      ],
      warnings: [],
      verifiedAt: new Date(),
      contentHash: '',
    }
  }

  // Validate manifest structure
  const manifestIssues = validateManifest(manifest)
  issues.push(...manifestIssues)

  // Analyze permissions
  if (manifest.permissions) {
    const { riskLevel, issues: permissionIssues } = analyzePermissions(manifest.permissions)
    issues.push(...permissionIssues)

    // Check if risk level exceeds maximum
    const riskLevels: SkillRiskLevel[] = ['low', 'medium', 'high', 'critical']
    if (riskLevels.indexOf(riskLevel) > riskLevels.indexOf(opts.maxRiskLevel)) {
      issues.push({
        severity: 'error',
        code: 'RISK_LEVEL_EXCEEDED',
        message: `Skill risk level (${riskLevel}) exceeds maximum allowed (${opts.maxRiskLevel})`,
        suggestion: 'Reduce the skill permissions or increase the allowed risk level',
      })
    }
  }

  // Calculate content hash
  const contentHash = await calculateSkillHash(skillPath, manifest)

  // Verify code hash if provided
  if (!opts.skipCodeHash && manifest.security?.codeHash) {
    if (manifest.security.codeHash !== contentHash) {
      issues.push({
        severity: 'error',
        code: 'CODE_HASH_MISMATCH',
        message: 'Skill code has been modified since signing',
        suggestion: 'The skill may have been tampered with. Do not use it.',
      })
    }
  }

  // Verify signature if required
  if (opts.requireSignature) {
    if (!manifest.security?.signature || !manifest.security?.publicKey) {
      issues.push({
        severity: 'error',
        code: 'SIGNATURE_MISSING',
        message: 'Skill is not signed',
        suggestion: 'Only use signed skills from trusted sources',
      })
    } else {
      const signatureValid = await verifySignature(
        manifest,
        contentHash,
        manifest.security.signature,
        manifest.security.publicKey
      )

      if (!signatureValid) {
        issues.push({
          severity: 'error',
          code: 'SIGNATURE_INVALID',
          message: 'Skill signature is invalid',
          suggestion: 'The skill may have been tampered with. Do not use it.',
        })
      }

      // Check if publisher is trusted
      if (opts.trustedPublishersOnly) {
        const isTrusted = Array.from(TRUSTED_PUBLIC_KEYS.values()).includes(
          manifest.security.publicKey
        )

        if (!isTrusted) {
          issues.push({
            severity: 'error',
            code: 'UNTRUSTED_PUBLISHER',
            message: 'Skill is signed by an untrusted publisher',
            suggestion: 'Only use skills from trusted publishers',
          })
        }
      }
    }
  } else {
    warnings.push('Signature verification is disabled')
  }

  // Check for known vulnerabilities
  if (manifest.security?.knownVulnerabilities?.length) {
    for (const cve of manifest.security.knownVulnerabilities) {
      issues.push({
        severity: 'error',
        code: 'KNOWN_VULNERABILITY',
        message: `Skill has known vulnerability: ${cve}`,
        suggestion: 'Update to a patched version',
      })
    }
  }

  // Scan for suspicious code patterns
  const codeIssues = await scanCodePatterns(skillPath, manifest)
  issues.push(...codeIssues)

  // Determine overall validity and risk
  const hasErrors = issues.some((i) => i.severity === 'error')
  const riskLevel = calculateOverallRisk(issues)

  return {
    isValid: !hasErrors,
    riskLevel,
    issues,
    warnings,
    verifiedAt: new Date(),
    contentHash,
  }
}

/**
 * Calculate SHA-256 hash of skill contents
 */
async function calculateSkillHash(skillPath: string, manifest: SkillManifest): Promise<string> {
  const hash = crypto.createHash('sha256')

  // Hash the manifest (excluding security metadata)
  const manifestForHash = { ...manifest }
  delete manifestForHash.security
  hash.update(JSON.stringify(manifestForHash, null, 2))

  // Hash the main entry file
  try {
    const mainPath = path.join(skillPath, manifest.main)
    const mainContent = await fs.readFile(mainPath, 'utf-8')
    hash.update(mainContent)
  } catch {
    // Main file not found - will be caught during validation
  }

  return hash.digest('hex')
}

/**
 * Verify Ed25519 signature
 */
async function verifySignature(
  manifest: SkillManifest,
  contentHash: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    // Create the message that was signed
    const message = JSON.stringify({
      id: manifest.id,
      version: manifest.version,
      contentHash,
    })

    // Import public key
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    })

    // Verify signature
    const isValid = crypto.verify(
      null, // Ed25519 doesn't use a separate hash algorithm
      Buffer.from(message),
      key,
      Buffer.from(signature, 'base64')
    )

    return isValid
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

/**
 * Scan skill code for suspicious patterns
 */
async function scanCodePatterns(
  skillPath: string,
  manifest: SkillManifest
): Promise<SkillIssue[]> {
  const issues: SkillIssue[] = []

  const suspiciousPatterns = [
    {
      pattern: /eval\s*\(/g,
      code: 'EVAL_USAGE',
      message: 'Code uses eval(), which is a security risk',
    },
    {
      pattern: /new\s+Function\s*\(/g,
      code: 'DYNAMIC_FUNCTION',
      message: 'Code creates functions dynamically',
    },
    {
      pattern: /process\.env/g,
      code: 'ENV_ACCESS',
      message: 'Code accesses environment variables',
    },
    {
      pattern: /child_process/g,
      code: 'CHILD_PROCESS',
      message: 'Code imports child_process module',
    },
    {
      pattern: /require\s*\(\s*['"][^'"]*['"]\s*\+/g,
      code: 'DYNAMIC_REQUIRE',
      message: 'Code uses dynamic require statements',
    },
    {
      pattern: /fetch\s*\(\s*['"`]https?:\/\//g,
      code: 'HARDCODED_URL',
      message: 'Code contains hardcoded external URLs',
    },
    {
      pattern: /Buffer\.from\s*\([^)]*,\s*['"]base64['"]\s*\)/g,
      code: 'BASE64_DECODE',
      message: 'Code decodes base64 data (potential obfuscation)',
    },
    {
      pattern: /\.replace\s*\(\s*\/\.\+\/g\s*,/g,
      code: 'REGEX_REPLACE_ALL',
      message: 'Code uses suspicious regex replacement pattern',
    },
  ]

  try {
    const mainPath = path.join(skillPath, manifest.main)
    const content = await fs.readFile(mainPath, 'utf-8')
    const lines = content.split('\n')

    for (const { pattern, code, message } of suspiciousPatterns) {
      let match: RegExpExecArray | null
      pattern.lastIndex = 0

      while ((match = pattern.exec(content)) !== null) {
        // Find line number
        const upToMatch = content.slice(0, match.index)
        const lineNumber = upToMatch.split('\n').length

        issues.push({
          severity: 'warning',
          code,
          message,
          location: {
            file: manifest.main,
            line: lineNumber,
          },
          suggestion: 'Review this code for security implications',
        })
      }
    }
  } catch {
    // File read error - already caught elsewhere
  }

  return issues
}

/**
 * Calculate overall risk level from issues
 */
function calculateOverallRisk(issues: SkillIssue[]): SkillRiskLevel {
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length

  if (errorCount >= 3 || issues.some((i) => i.code === 'KNOWN_VULNERABILITY')) {
    return 'critical'
  }
  if (errorCount >= 1) {
    return 'high'
  }
  if (warningCount >= 3) {
    return 'medium'
  }
  if (warningCount >= 1) {
    return 'low'
  }
  return 'low'
}

/**
 * Sign a skill with a private key
 */
export async function signSkill(
  skillPath: string,
  privateKeyPath: string
): Promise<{ signature: string; publicKey: string; contentHash: string }> {
  // Load manifest
  const manifestPath = path.join(skillPath, 'atlas-skill.json')
  const content = await fs.readFile(manifestPath, 'utf-8')
  const manifest = JSON.parse(content) as SkillManifest

  // Calculate content hash
  const contentHash = await calculateSkillHash(skillPath, manifest)

  // Load private key
  const privateKeyPem = await fs.readFile(privateKeyPath, 'utf-8')
  const privateKey = crypto.createPrivateKey(privateKeyPem)

  // Create the message to sign
  const message = JSON.stringify({
    id: manifest.id,
    version: manifest.version,
    contentHash,
  })

  // Sign
  const signature = crypto.sign(null, Buffer.from(message), privateKey)

  // Extract public key
  const publicKey = crypto.createPublicKey(privateKey)
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' })

  return {
    signature: signature.toString('base64'),
    publicKey: publicKeyDer.toString('base64'),
    contentHash,
  }
}

/**
 * Add a trusted public key
 */
export function addTrustedPublicKey(name: string, publicKey: string): void {
  TRUSTED_PUBLIC_KEYS.set(name, publicKey)
}

/**
 * Remove a trusted public key
 */
export function removeTrustedPublicKey(name: string): boolean {
  return TRUSTED_PUBLIC_KEYS.delete(name)
}

/**
 * List trusted public keys
 */
export function listTrustedPublicKeys(): string[] {
  return Array.from(TRUSTED_PUBLIC_KEYS.keys())
}
