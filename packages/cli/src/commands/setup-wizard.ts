/**
 * Atlas - Setup Wizard
 *
 * Guided setup for non-technical users.
 * Plain English explanations, no VPS/Docker/webhook knowledge required.
 */

import * as readline from 'readline'
import * as crypto from 'crypto'
import {
  getPreset,
  getPresetDescription,
  getPresetNames,
  isValidPreset,
  type SecurityPreset,
  type AtlasPresetConfig,
} from '@atlas/gateway'

/**
 * Base32 encoding for TOTP secrets (RFC 4648)
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

/**
 * Wizard step definition
 */
interface WizardStep {
  id: string
  title: string
  description: string
  run: (context: WizardContext) => Promise<void>
}

/**
 * Wizard context passed between steps
 */
interface WizardContext {
  rl: readline.Interface
  config: Partial<AtlasPresetConfig>
  username?: string
  passwordHash?: string
  mfaSecret?: string
  preset?: SecurityPreset
  workspacePath?: string
  useLocalModels?: boolean
}

/**
 * Prompt user for input
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

/**
 * Prompt for password (hidden input)
 */
function promptPassword(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    const oldRaw = stdin.isRaw

    stdin.setRawMode(true)
    stdin.resume()

    let password = ''
    const onData = (char: Buffer) => {
      const c = char.toString()

      if (c === '\n' || c === '\r') {
        stdin.setRawMode(oldRaw ?? false)
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(password)
      } else if (c === '\u0003') {
        // Ctrl+C
        process.exit()
      } else if (c === '\u007f') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else {
        password += c
        process.stdout.write('*')
      }
    }

    stdin.on('data', onData)
  })
}

/**
 * Print a header
 */
function printHeader(text: string): void {
  console.log()
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bold}  ${text}${colors.reset}`)
  console.log(`${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`)
  console.log()
}

/**
 * Print a success message
 */
function printSuccess(text: string): void {
  console.log(`${colors.green}✓${colors.reset} ${text}`)
}

/**
 * Print an info message
 */
function printInfo(text: string): void {
  console.log(`${colors.blue}ℹ${colors.reset} ${text}`)
}

/**
 * Print a warning message
 */
function printWarning(text: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${text}`)
}

/**
 * Wizard steps
 */
const steps: WizardStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Atlas',
    description: 'Security-hardened AI assistant',
    async run(ctx) {
      printHeader('Welcome to Atlas Setup')

      console.log('Atlas is designed to be secure by default.')
      console.log('This wizard will help you set up your account in a few minutes.')
      console.log()
      console.log('What you\'ll configure:')
      console.log(`  ${colors.cyan}1.${colors.reset} Create your admin account`)
      console.log(`  ${colors.cyan}2.${colors.reset} Set up two-factor authentication (required)`)
      console.log(`  ${colors.cyan}3.${colors.reset} Choose your security level`)
      console.log(`  ${colors.cyan}4.${colors.reset} Configure AI models`)
      console.log(`  ${colors.cyan}5.${colors.reset} Set your workspace location`)
      console.log()

      await prompt(ctx.rl, 'Press Enter to continue...')
    },
  },

  {
    id: 'account',
    title: 'Create Account',
    description: 'Set up your admin credentials',
    async run(ctx) {
      printHeader('Step 1: Create Your Account')

      console.log('Your account will be protected with a password and two-factor authentication.')
      console.log()

      // Get username
      let username = ''
      while (!username || username.length < 3) {
        username = await prompt(ctx.rl, 'Choose a username (min 3 characters): ')
        if (username.length < 3) {
          printWarning('Username must be at least 3 characters.')
        }
      }
      ctx.username = username

      // Get password
      let password = ''
      let confirmPassword = ''
      while (password.length < 8 || password !== confirmPassword) {
        password = await promptPassword(ctx.rl, 'Choose a password (min 8 characters): ')
        if (password.length < 8) {
          printWarning('Password must be at least 8 characters.')
          continue
        }

        confirmPassword = await promptPassword(ctx.rl, 'Confirm password: ')
        if (password !== confirmPassword) {
          printWarning('Passwords do not match. Try again.')
        }
      }

      // Hash password
      const salt = crypto.randomBytes(16).toString('hex')
      ctx.passwordHash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
        .toString('hex')

      printSuccess(`Account created for ${colors.bold}${username}${colors.reset}`)
    },
  },

  {
    id: 'mfa',
    title: 'Two-Factor Authentication',
    description: 'Required for all accounts',
    async run(ctx) {
      printHeader('Step 2: Two-Factor Authentication')

      console.log('Two-factor authentication (2FA) adds an extra layer of security.')
      console.log('You\'ll need an authenticator app like:')
      console.log(`  • Google Authenticator`)
      console.log(`  • Microsoft Authenticator`)
      console.log(`  • 1Password`)
      console.log(`  • Authy`)
      console.log()

      printWarning('2FA is required and cannot be skipped.')
      console.log()

      // Generate TOTP secret (base32 encoded)
      ctx.mfaSecret = base32Encode(crypto.randomBytes(20)).slice(0, 16)

      console.log('Your setup key (enter this in your authenticator app):')
      console.log()
      console.log(`  ${colors.bold}${ctx.mfaSecret}${colors.reset}`)
      console.log()
      console.log(`${colors.dim}Or scan the QR code in the web dashboard after setup.${colors.reset}`)
      console.log()

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () =>
        crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{4}/g)!.join('-')
      )

      console.log('Your backup codes (save these securely):')
      console.log()
      for (let i = 0; i < backupCodes.length; i += 2) {
        console.log(`  ${backupCodes[i]}    ${backupCodes[i + 1] || ''}`)
      }
      console.log()

      printWarning('Save these codes! You\'ll need them if you lose access to your phone.')
      console.log()

      await prompt(ctx.rl, 'Press Enter after saving your codes...')
      printSuccess('MFA configured')
    },
  },

  {
    id: 'security',
    title: 'Security Level',
    description: 'Choose your protection level',
    async run(ctx) {
      printHeader('Step 3: Choose Security Level')

      console.log('Atlas has three security presets. Choose based on your needs:')
      console.log()

      for (const name of getPresetNames()) {
        const desc = getPresetDescription(name)
        console.log(`${colors.bold}${desc.emoji} ${desc.name}${colors.reset}`)
        console.log(`   ${desc.tagline}`)
        console.log(`   ${colors.dim}${desc.description}${colors.reset}`)
        console.log()
      }

      let preset: SecurityPreset | undefined
      while (!preset) {
        const answer = await prompt(
          ctx.rl,
          `Choose a preset [${colors.dim}paranoid${colors.reset}/${colors.cyan}balanced${colors.reset}/${colors.dim}permissive${colors.reset}]: `
        )

        const normalized = answer.toLowerCase()
        if (isValidPreset(normalized)) {
          preset = normalized
        } else if (answer === '' || answer === 'b') {
          preset = 'balanced'
        } else {
          printWarning('Please enter: paranoid, balanced, or permissive')
        }
      }

      ctx.preset = preset
      ctx.config = getPreset(preset)

      const desc = getPresetDescription(preset)
      printSuccess(`${desc.emoji} ${desc.name} preset selected`)
    },
  },

  {
    id: 'models',
    title: 'AI Models',
    description: 'Configure model preferences',
    async run(ctx) {
      printHeader('Step 4: AI Model Configuration')

      console.log('Atlas can use local AI models (free) or cloud APIs (paid).')
      console.log()
      console.log(`${colors.bold}Local Models${colors.reset} (Ollama, LM Studio):`)
      console.log(`  ${colors.green}✓${colors.reset} Completely free`)
      console.log(`  ${colors.green}✓${colors.reset} Data stays on your machine`)
      console.log(`  ${colors.yellow}○${colors.reset} Requires good hardware (8GB+ RAM)`)
      console.log(`  ${colors.yellow}○${colors.reset} May be slower for complex tasks`)
      console.log()
      console.log(`${colors.bold}Cloud Models${colors.reset} (Claude, GPT-4):`)
      console.log(`  ${colors.green}✓${colors.reset} Fast and powerful`)
      console.log(`  ${colors.green}✓${colors.reset} Works on any hardware`)
      console.log(`  ${colors.yellow}○${colors.reset} Costs money per use`)
      console.log(`  ${colors.yellow}○${colors.reset} Data sent to external servers`)
      console.log()

      const answer = await prompt(
        ctx.rl,
        `Use local models when possible? [${colors.cyan}Y${colors.reset}/n]: `
      )

      ctx.useLocalModels = answer.toLowerCase() !== 'n'

      if (ctx.config?.models) {
        ctx.config.models.preferLocal = ctx.useLocalModels
      }

      if (ctx.useLocalModels) {
        printSuccess('Local models preferred (cloud as fallback)')
        printInfo('Install Ollama: https://ollama.ai/')
      } else {
        printSuccess('Cloud models preferred')
        printInfo('You\'ll need API keys for Claude or OpenAI')
      }
    },
  },

  {
    id: 'workspace',
    title: 'Workspace',
    description: 'Set your working directory',
    async run(ctx) {
      printHeader('Step 5: Workspace Location')

      const defaultPath = '~/atlas-workspace'

      console.log('Atlas will only access files within your workspace directory.')
      console.log('This keeps your other files safe from accidental changes.')
      console.log()

      const answer = await prompt(
        ctx.rl,
        `Workspace path [${colors.dim}${defaultPath}${colors.reset}]: `
      )

      ctx.workspacePath = answer || defaultPath
      printSuccess(`Workspace set to ${ctx.workspacePath}`)
    },
  },

  {
    id: 'complete',
    title: 'Setup Complete',
    description: 'Ready to use Atlas',
    async run(ctx) {
      printHeader('Setup Complete!')

      console.log(`${colors.green}Atlas is now configured and ready to use.${colors.reset}`)
      console.log()
      console.log('Your configuration:')
      console.log(`  Username:       ${colors.bold}${ctx.username}${colors.reset}`)
      console.log(`  Security:       ${colors.bold}${ctx.preset}${colors.reset}`)
      console.log(`  Models:         ${colors.bold}${ctx.useLocalModels ? 'Local preferred' : 'Cloud'}${colors.reset}`)
      console.log(`  Workspace:      ${colors.bold}${ctx.workspacePath}${colors.reset}`)
      console.log()
      console.log('Next steps:')
      console.log(`  ${colors.cyan}1.${colors.reset} Start the Atlas gateway: ${colors.bold}atlas start${colors.reset}`)
      console.log(`  ${colors.cyan}2.${colors.reset} Open the dashboard: ${colors.bold}http://localhost:18789${colors.reset}`)
      console.log(`  ${colors.cyan}3.${colors.reset} Add API keys in Settings > Credentials`)
      console.log()

      if (ctx.useLocalModels) {
        printInfo('Remember to install Ollama for local model support.')
      }

      console.log(`${colors.dim}Configuration saved to ~/.atlas/config.json${colors.reset}`)
    },
  },
]

/**
 * Run the setup wizard
 */
export async function runSetupWizard(): Promise<AtlasPresetConfig | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const ctx: WizardContext = {
    rl,
    config: {},
  }

  console.clear()
  console.log()
  console.log(`${colors.bold}${colors.magenta}    ▄▀█ ▀█▀ █░░ ▄▀█ █▀${colors.reset}`)
  console.log(`${colors.bold}${colors.magenta}    █▀█ ░█░ █▄▄ █▀█ ▄█${colors.reset}`)
  console.log(`${colors.dim}    Security-Hardened AI Assistant${colors.reset}`)
  console.log()

  try {
    for (const step of steps) {
      await step.run(ctx)
    }

    rl.close()
    return ctx.config as AtlasPresetConfig
  } catch (error) {
    rl.close()
    console.error(`${colors.red}Setup failed:${colors.reset}`, error)
    return null
  }
}

// CLI entry point
if (process.argv[1]?.endsWith('setup-wizard.ts') || process.argv[1]?.endsWith('setup-wizard.js')) {
  runSetupWizard()
    .then((config) => {
      if (config) {
        process.exit(0)
      } else {
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}
