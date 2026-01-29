# Atlas - Security-Hardened AI Assistant

Atlas is a secure fork of Moltbot, addressing critical security vulnerabilities identified by security researchers (Hudson Rock, Dvuln, Bitdefender, SlowMist).

## Why Atlas?

Moltbot/ClawdBot has known security issues:
- **300+ instances exposed** via Shodan with 8 having zero authentication
- **Plaintext credential storage** targeted by infostealers (Redline, Lumma, Vidar)
- **5-minute credential theft** demonstrated via prompt injection
- **Supply chain poisoning** possible via malicious skills

Atlas addresses these with a security-first architecture.

## P0 Security Features

### Phase 1: Security Foundation

#### 1.1 Encrypted Credential Storage
- Primary: OS keychain via `keytar` (macOS Keychain, Linux Secret Service, Windows Credential Vault)
- Fallback: AES-256-GCM encryption with device-derived keys
- Auto-migration from plaintext `auth-profiles.json`

```typescript
import { getCredentialStore } from '@atlas/gateway';

const store = getCredentialStore();
await store.store('openai', 'OpenAI API Key', 'openai', 'sk-...');
const key = await store.retrieve('openai');
```

#### 1.2 Mandatory MFA Authentication
- TOTP-based two-factor authentication (speakeasy)
- MFA is **required** - no bypass option
- 15-minute JWT tokens with refresh
- Backup codes for recovery

```typescript
import { getMFAManager, getJWTManager } from '@atlas/gateway';

const mfa = getMFAManager();
const setup = mfa.generateSecret('user@example.com');
// Display QR code for setup.otpauthUrl

const isValid = mfa.verifyCode(setup.secret, '123456');
```

#### 1.3 Zero-Trust Network Architecture
- **No implicit localhost trust** (prevents proxy misconfiguration attacks)
- Explicit IP allowlists required
- Rate limiting built-in
- TLS support

```typescript
import { getNetworkSecurityManager } from '@atlas/gateway';

const network = getNetworkSecurityManager({
  allowedIPs: ['192.168.1.0/24'],
  bindAddress: '127.0.0.1', // Local-only by default
});
```

### Phase 2: Execution Isolation

#### 2.1 Docker Sandboxing
- **No sandbox = No execution** (enforced, not optional)
- Read-only root filesystem
- All capabilities dropped
- Memory/CPU limits
- Seccomp syscall filtering

```typescript
import { getDockerSandboxExecutor } from '@atlas/gateway';

const sandbox = getDockerSandboxExecutor();
await sandbox.initialize();
const result = await sandbox.exec('ls', ['-la']);
```

#### 2.2 Command Allowlisting
- Deny-by-default for all commands
- Pre-approved safe commands (ls, cat, grep, git status, etc.)
- Dangerous commands require explicit approval
- Per-directory filesystem scoping

```typescript
import { getAllowlistManager } from '@atlas/gateway';

const allowlist = getAllowlistManager();
const decision = allowlist.checkCommand('rm', ['-rf', '/']);
// { allowed: false, reason: "Command 'rm' requires approval", ... }
```

### Phase 3: Prompt Injection Defense

#### 3.1 Input Sanitization
- Multi-layer sanitization pipeline
- XML-tagged isolation for untrusted content
- Source-based trust scoring
- Known injection pattern detection

```typescript
import { getInputSanitizer } from '@atlas/gateway';

const sanitizer = getInputSanitizer();
const result = sanitizer.sanitize(userInput, 'web');
// Wraps in <external-web-content trust="untrusted">...</external-web-content>
```

#### 3.2 Output Validation
- Credential pattern detection (OpenAI, AWS, GitHub, etc.)
- Exfiltration attempt blocking
- Suspicious host detection (webhook.site, ngrok, etc.)
- Rate limiting for sensitive operations

```typescript
import { getOutputValidator } from '@atlas/gateway';

const validator = getOutputValidator();
const result = validator.validate(agentOutput);
if (result.blocked) {
  console.error(`Blocked: ${result.reason}`);
}
```

## P1 Features

### Web Dashboard
Modern security dashboard built with Next.js 15, Tailwind CSS 4, and Radix UI.

```bash
cd packages/web-ui && npm run dev
```

**Pages:**
- `/` - Security overview dashboard
- `/login` - Authentication with MFA
- `/setup-mfa` - 7-step MFA enrollment wizard
- `/security` - Security event monitoring
- `/security/credentials` - Credential management
- `/security/allowlist` - Command allowlist configuration
- `/costs` - Token usage & budget tracking
- `/settings` - Configuration

### Local Model Support
Route requests to local models (free) for simple tasks, cloud APIs for complex tasks.

```typescript
import { ModelRouter, CostTracker } from '@atlas/gateway';

const router = new ModelRouter({ autoDetectComplexity: true });
const response = await router.route({ prompt: 'List files in current directory' });
// Routes to ollama:llama3 (free) for simple tasks

const tracker = new CostTracker();
tracker.updateBudget({ dailyLimit: 10 }); // $10/day limit
console.log(tracker.getTodaySpend());
```

**Supported Providers:**
- Ollama (llama3, mistral, codellama)
- LM Studio (any GGUF model)

### Skill Verification
Prevent supply chain attacks with skill signing and verification.

```typescript
import { verifySkill } from '@atlas/gateway';

const result = await verifySkill('./my-skill', {
  requireSignature: true,
  trustedPublishersOnly: true,
  maxRiskLevel: 'medium',
});

if (!result.isValid) {
  console.log('Issues:', result.issues);
}
```

### Security Presets
Pre-configured security profiles for different use cases.

```typescript
import { getPreset } from '@atlas/gateway';

const paranoid = getPreset('paranoid');
// Local-only, all approvals required, no network

const balanced = getPreset('balanced');
// Docker sandbox, safe commands auto-approved

const permissive = getPreset('permissive');
// Network access, dangerous commands need approval
```

## Installation

```bash
npm install @atlas/gateway
```

### Requirements
- Node.js 20+
- Docker (for sandboxed execution)
- Optional: System keychain access (keytar native module)

## Quick Start

```typescript
import {
  getCredentialStore,
  getMFAManager,
  getDockerSandboxExecutor,
  getAllowlistManager,
  getInputSanitizer,
  getOutputValidator,
} from '@atlas/gateway';

// 1. Initialize credential store
const credentials = getCredentialStore();
await credentials.initialize();

// 2. Set up MFA (required)
const mfa = getMFAManager();
const { secret, otpauthUrl, backupCodes } = mfa.generateSecret('you@example.com');
// Store secret securely, show QR code to user

// 3. Initialize sandbox
const sandbox = getDockerSandboxExecutor();
await sandbox.initialize();

// 4. Process user input
const sanitizer = getInputSanitizer();
const sanitized = sanitizer.sanitize(userMessage, 'user');

if (sanitized.injectionAttemptDetected) {
  console.warn('Potential prompt injection detected!');
}

// 5. Check command before execution
const allowlist = getAllowlistManager();
const decision = allowlist.checkCommand('ls', ['-la']);

if (!decision.allowed) {
  if (decision.requiresApproval) {
    // Ask user for approval
  } else {
    // Block entirely
  }
}

// 6. Execute in sandbox
const result = await sandbox.exec('ls', ['-la']);

// 7. Validate output before returning
const validator = getOutputValidator();
const validation = validator.validate(result.stdout);

if (validation.blocked) {
  console.error('Output blocked:', validation.reason);
}
```

## Security Comparison

| Feature | Moltbot | Atlas |
|---------|---------|-------|
| Credential Storage | Plaintext JSON | Encrypted (keytar/AES-256-GCM) |
| Authentication | Optional | Mandatory MFA |
| Localhost Trust | Implicit | Zero-trust (explicit allowlist) |
| Sandboxing | Optional warning | Enforced (no sandbox = no execution) |
| Command Filtering | None | Deny-by-default allowlist |
| Prompt Injection Defense | None | Multi-layer sanitization |
| Output Validation | None | Credential exfiltration blocking |

## Roadmap

### P0 Security Foundation (Complete)
- [x] Encrypted credential storage
- [x] Mandatory MFA authentication
- [x] Zero-trust network architecture
- [x] Docker sandboxing
- [x] Command allowlisting
- [x] Prompt injection defense
- [x] Output validation

### P1 Features (Complete)
- [x] Web Dashboard UI (Next.js 15, Tailwind 4, Radix UI)
- [x] Skill verification & code signing (Ed25519 signatures)
- [x] Local model support (Ollama, LM Studio integration)
- [x] Simplified onboarding wizard (security presets)
- [x] Cost tracking & budget management

### P2 (Next)
- [ ] Human-in-the-loop approvals
- [ ] Token optimization
- [ ] Stability improvements

### P3
- [ ] Enterprise audit logging
- [ ] Advanced analytics

## Contributing

Security contributions are especially welcome. Please report vulnerabilities via security@atlas.dev (once established).

## License

MIT

## Acknowledgments

- Security research by Hudson Rock, Dvuln (Jamieson O'Reilly), Bitdefender, SlowMist
- Community feedback from Hacker News and GitHub discussions
- Original Moltbot project for the foundation
