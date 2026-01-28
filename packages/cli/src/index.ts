#!/usr/bin/env node

/**
 * Atlas CLI - Main Entry Point
 *
 * Command-line interface for Atlas AI assistant.
 */

import { runSetupWizard } from './commands/setup-wizard.js'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  switch (command) {
    case 'setup':
    case 'init':
      await runSetupWizard()
      break

    case 'start':
      console.log('Starting Atlas gateway...')
      console.log('(Gateway server implementation pending)')
      break

    case 'status':
      console.log('Atlas Status')
      console.log('============')
      console.log('Gateway: Not running')
      console.log('Dashboard: http://localhost:18789')
      break

    case 'version':
    case '-v':
    case '--version':
      console.log('Atlas v0.1.0')
      break

    case 'help':
    case '-h':
    case '--help':
    default:
      printHelp()
      break
  }
}

function printHelp() {
  console.log(`
Atlas - Security-Hardened AI Assistant

Usage: atlas <command> [options]

Commands:
  setup         Run the interactive setup wizard
  start         Start the Atlas gateway server
  status        Show Atlas status
  version       Show version information
  help          Show this help message

Examples:
  atlas setup   # First-time setup
  atlas start   # Start the gateway

Documentation: https://github.com/your-org/atlas
`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
