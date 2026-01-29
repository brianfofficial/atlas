'use client'

import { useState, useCallback, createContext, useContext, ReactNode } from 'react'

export interface HelpTopic {
  id: string
  title: string
  summary: string
  content: string
  relatedTopics?: string[]
  category: HelpCategory
}

export type HelpCategory =
  | 'security'
  | 'credentials'
  | 'commands'
  | 'costs'
  | 'getting-started'

export interface HelpContextValue {
  // State
  isOpen: boolean
  currentTopic: HelpTopic | null
  searchQuery: string
  history: string[]

  // Actions
  openHelp: (topicId?: string) => void
  closeHelp: () => void
  setTopic: (topicId: string) => void
  search: (query: string) => void
  goBack: () => void
  clearHistory: () => void

  // Queries
  getTopicById: (id: string) => HelpTopic | undefined
  searchTopics: (query: string) => HelpTopic[]
  getTopicsByCategory: (category: HelpCategory) => HelpTopic[]
}

/**
 * All help topics with plain-language content
 */
export const HELP_TOPICS: HelpTopic[] = [
  // Getting Started
  {
    id: 'what-is-atlas',
    title: 'What is Atlas?',
    summary: 'An AI assistant that helps you automate tasks safely.',
    content: `Atlas is your personal AI assistant that can help you automate tasks, manage files, and work with different services.

**What makes Atlas special:**
- **Security first** - Everything runs in a safe, isolated environment
- **Your control** - Only approved actions can run
- **Private** - Your data stays on your devices

**Common uses:**
- Automating repetitive tasks
- Managing files and folders
- Connecting to other services
- Running scheduled jobs`,
    category: 'getting-started',
    relatedTopics: ['how-security-works', 'first-credential'],
  },
  {
    id: 'how-security-works',
    title: 'How your data stays safe',
    summary: 'Multiple layers of protection keep your information secure.',
    content: `Atlas uses several layers of security to protect you:

**Bank-level encryption**
All your passwords and keys are encrypted using the same technology banks use. Even if someone got the files, they couldn't read them.

**Two-step login**
You need both your password AND a code from your phone to log in. This stops attackers even if they steal your password.

**Safe execution environment**
Commands run in an isolated "sandbox" - like a virtual room that can't touch your real files or system.

**Only approved actions**
By default, Atlas can only run commands you've approved. Anything else is automatically blocked.

**Always verifying**
Every request is checked, even from inside your network. We never assume something is safe just because of where it came from.`,
    category: 'security',
    relatedTopics: ['what-is-encryption', 'what-is-mfa', 'what-is-sandbox'],
  },
  {
    id: 'what-is-encryption',
    title: 'What is encryption?',
    summary: 'How your passwords are scrambled to keep them safe.',
    content: `Encryption is like a secret code that scrambles your information so only you can read it.

**How it works:**
When you save a password in Atlas, it's immediately scrambled using a mathematical formula. The scrambled version looks like random characters and is useless without your special key.

**Your key:**
Your encryption key is stored in your device's secure keychain (like Apple's Keychain or Windows Credential Manager). This means:
- Only you can unlock your passwords
- If someone copies your files, they can't read them
- If you lose your device, your passwords stay safe

**The technical name:**
Atlas uses "AES-256-GCM" encryption - the same standard used by banks and governments. You don't need to remember that, just know it's the best available!`,
    category: 'security',
    relatedTopics: ['how-security-works', 'credential-rotation'],
  },
  {
    id: 'what-is-mfa',
    title: 'What is two-step login?',
    summary: 'An extra layer of security using your phone.',
    content: `Two-step login (also called MFA or 2FA) adds an extra check when you log in.

**How it works:**
1. You enter your password (something you know)
2. You enter a code from your phone app (something you have)

Even if someone steals your password, they can't log in without your phone.

**Setting it up:**
1. Download an authenticator app (Google Authenticator, Authy, etc.)
2. Scan the QR code Atlas shows you
3. Enter the 6-digit code to confirm
4. Save your emergency codes somewhere safe

**The codes:**
The app shows a new 6-digit code every 30 seconds. This code works even without internet, because it's calculated using a shared secret.

**Emergency codes:**
If you lose your phone, you can use one of your emergency backup codes to log in. Each code only works once, so save them somewhere secure!`,
    category: 'security',
    relatedTopics: ['backup-codes', 'trusted-devices'],
  },
  {
    id: 'what-is-sandbox',
    title: 'What is the safe environment?',
    summary: 'How commands run without risking your system.',
    content: `The sandbox is an isolated space where Atlas runs commands safely.

**Think of it like:**
A sealed room where tasks run. The room has:
- Its own copy of files (can't see your real ones)
- No internet access by default
- Limited memory and computing power
- An automatic timeout (stops if it takes too long)

**Why it matters:**
If a command tried to do something harmful, it can only affect the sandbox - not your real computer. When the command finishes, the sandbox is deleted.

**Technical name:**
This is called "Docker container isolation." You don't need to worry about the details - just know that Atlas can't accidentally (or intentionally) harm your system.`,
    category: 'security',
    relatedTopics: ['approved-commands', 'how-security-works'],
  },
  {
    id: 'backup-codes',
    title: 'Emergency backup codes',
    summary: 'How to log in if you lose your phone.',
    content: `Backup codes are one-time passwords you can use if you can't access your authenticator app.

**When to use them:**
- Your phone is lost or stolen
- You got a new phone and forgot to transfer the app
- Your authenticator app was deleted

**How they work:**
Each code can only be used once. After you use one, cross it off your list.

**Keep them safe:**
- Print them and store with important documents
- Save in a password manager
- DON'T store only on your phone (defeats the purpose!)

**Running low on codes?**
You can generate new backup codes in Settings. This will replace your old codes, so make sure to save the new ones.`,
    category: 'security',
    relatedTopics: ['what-is-mfa', 'account-recovery'],
  },
  {
    id: 'trusted-devices',
    title: 'Trusted devices',
    summary: 'Devices you\'ve verified can access your account.',
    content: `A trusted device is a computer or phone that you've confirmed is yours.

**How to add a device:**
When you log in from a new device, Atlas will:
1. Ask for your password and verification code
2. Show you the device name and location
3. Ask if you want to trust this device

**Managing devices:**
In Settings > Devices, you can:
- See all your trusted devices
- Remove devices you don't recognize
- See when each device last logged in

**Security tip:**
If you see a device you don't recognize, remove it immediately and change your password. Someone may have accessed your account.

**Device limits:**
You can have up to 10 trusted devices. If you need more, remove an old one first.`,
    category: 'security',
    relatedTopics: ['what-is-mfa', 'suspicious-activity'],
  },

  // Credentials
  {
    id: 'first-credential',
    title: 'Adding your first connection',
    summary: 'Connect Atlas to a service you use.',
    content: `Credentials let Atlas connect to other services on your behalf.

**What are credentials?**
They're like special passwords that let Atlas talk to other services (like GitHub, Slack, or OpenAI).

**To add one:**
1. Go to Security > Credentials
2. Click "Add Credential"
3. Choose the service type
4. Enter your API key or password
5. Give it a nickname you'll remember

**Where to find your API key:**
Each service has a different place:
- **OpenAI**: platform.openai.com > API Keys
- **GitHub**: Settings > Developer Settings > Personal access tokens
- **Slack**: api.slack.com > Your Apps

**What happens next:**
Your credential is encrypted immediately. Atlas can use it to connect to that service, but the actual password is never visible again.`,
    category: 'credentials',
    relatedTopics: ['credential-rotation', 'what-is-encryption'],
  },
  {
    id: 'credential-rotation',
    title: 'Refreshing your passwords',
    summary: 'Why and how to update old credentials.',
    content: `Credential rotation means replacing old passwords with new ones.

**Why do this?**
- Passwords can be leaked without you knowing
- The longer a password exists, the more time attackers have to guess it
- Some services require regular updates

**When to rotate:**
Atlas will remind you when credentials are getting old:
- **60 days**: Optional reminder
- **90 days**: Recommended to rotate
- **180 days**: Strongly recommended

**How to rotate:**
1. Go to the service's website and generate a new API key
2. In Atlas, click "Rotate" on the credential
3. Enter the new key
4. The old key is automatically replaced

**Don't forget:**
After rotating in Atlas, you may want to delete the old key from the service's website too, so it can't be used anymore.`,
    category: 'credentials',
    relatedTopics: ['first-credential', 'security-best-practices'],
  },

  // Commands
  {
    id: 'approved-commands',
    title: 'What commands can run?',
    summary: 'Only commands you\'ve approved are allowed.',
    content: `Atlas uses an "allowlist" - a list of approved commands.

**Safe by default:**
Some basic commands are pre-approved because they can't harm anything:
- **ls** - list files
- **cat** - read a file
- **grep** - search in files
- **git status** - check git state

**Blocked by default:**
Commands that could cause problems are blocked unless you approve them:
- **rm** - delete files
- **curl/wget** - download from internet
- **ssh** - connect to other servers
- **npm/pip** - install packages

**Adding to the list:**
1. Go to Security > Approved Commands
2. Click "Add Command"
3. Choose the command and any restrictions
4. Confirm you understand the risks

**Need approval each time:**
Some commands are "dangerous" and require your approval every time, even if on the list. Atlas will pause and ask before running them.`,
    category: 'commands',
    relatedTopics: ['what-is-sandbox', 'dangerous-commands'],
  },
  {
    id: 'dangerous-commands',
    title: 'Dangerous commands',
    summary: 'Commands that need extra caution.',
    content: `Some commands can cause serious problems if misused. Atlas is extra careful with these.

**Always blocked:**
These commands are never allowed, even with approval:
- **sudo** - run as administrator
- **rm -rf /** - delete everything
- **mkfs** - format drives
- **dd** - direct disk access

**Require approval each time:**
These need your OK every single time:
- **rm** - delete files
- **mv** to critical paths - move important files
- **chmod 777** - make files public
- **curl | bash** - download and run scripts

**Why so careful?**
A single wrong command can:
- Delete all your files
- Expose sensitive data
- Break your system

It's better to click "approve" a few extra times than to lose your data!`,
    category: 'commands',
    relatedTopics: ['approved-commands', 'what-is-sandbox'],
  },

  // Costs
  {
    id: 'understanding-costs',
    title: 'How AI usage works',
    summary: 'What costs money and how to save.',
    content: `When Atlas uses AI to help you, it may use paid services.

**What costs money:**
- **Cloud AI** (like Claude or GPT-4): Charged by usage
- **Complex tasks**: Use more AI capacity
- **Long conversations**: Use more context

**What's free:**
- **Local AI**: Running on your own computer
- **Simple commands**: No AI needed
- **Cached responses**: Already answered

**Seeing your usage:**
The Costs page shows:
- Today's spending
- This month's total
- Which services you're using
- Tips to save money

**Setting limits:**
You can set a daily budget. When you reach it, Atlas will:
1. Try to use local AI instead
2. Warn you before going over
3. Stop if you want`,
    category: 'costs',
    relatedTopics: ['local-vs-cloud', 'cost-saving-tips'],
  },
  {
    id: 'local-vs-cloud',
    title: 'Local vs. cloud AI',
    summary: 'Trade-offs between privacy and power.',
    content: `Atlas can use AI running on your computer (local) or online services (cloud).

**Local AI:**
✓ Free to use
✓ 100% private
✓ Works offline
✗ Less powerful
✗ Uses your computer's resources

**Cloud AI:**
✓ More powerful
✓ Better at complex tasks
✓ Faster responses
✗ Costs money
✗ Data leaves your device

**Best of both:**
Atlas can automatically choose:
- Simple questions → Local AI (free)
- Complex tasks → Cloud AI (better results)

You can also force one or the other in Settings if you prefer.`,
    category: 'costs',
    relatedTopics: ['understanding-costs', 'cost-saving-tips'],
  },
  {
    id: 'cost-saving-tips',
    title: 'Save money on AI',
    summary: 'Tips to reduce your usage costs.',
    content: `A few changes can significantly reduce your AI costs.

**Use local AI when possible:**
For basic tasks, local AI is free and often fast enough.

**Be specific:**
Vague requests need more back-and-forth. Clear instructions get faster results.

**Start fresh sometimes:**
Long conversations use more context. Starting a new conversation for new topics is cheaper.

**Set a budget:**
Daily limits prevent surprise bills. Start low and increase if needed.

**Check the dashboard:**
The Costs page shows what's using the most. Look for patterns you can optimize.

**Cache common requests:**
If you ask similar things often, Atlas can remember and reuse answers.`,
    category: 'costs',
    relatedTopics: ['understanding-costs', 'local-vs-cloud'],
  },
]

/**
 * Get a topic by its ID
 */
export function getTopicById(id: string): HelpTopic | undefined {
  return HELP_TOPICS.find(t => t.id === id)
}

/**
 * Search topics by query
 */
export function searchTopics(query: string): HelpTopic[] {
  if (!query.trim()) return []

  const lower = query.toLowerCase()
  return HELP_TOPICS.filter(
    t =>
      t.title.toLowerCase().includes(lower) ||
      t.summary.toLowerCase().includes(lower) ||
      t.content.toLowerCase().includes(lower)
  ).slice(0, 10) // Limit results
}

/**
 * Get topics by category
 */
export function getTopicsByCategory(category: HelpCategory): HelpTopic[] {
  return HELP_TOPICS.filter(t => t.category === category)
}

// Context for global help state
const HelpContext = createContext<HelpContextValue | null>(null)

/**
 * Hook to access help system
 */
export function useHelp(): HelpContextValue {
  const context = useContext(HelpContext)
  if (!context) {
    throw new Error('useHelp must be used within HelpProvider')
  }
  return context
}

/**
 * Provider component props
 */
interface HelpProviderProps {
  children: ReactNode
}

/**
 * Provider component for help system
 */
export function HelpProvider({ children }: HelpProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [history, setHistory] = useState<string[]>([])

  const currentTopic = currentTopicId ? getTopicById(currentTopicId) ?? null : null

  const openHelp = useCallback((topicId?: string) => {
    setIsOpen(true)
    if (topicId) {
      setCurrentTopicId(topicId)
    }
  }, [])

  const closeHelp = useCallback(() => {
    setIsOpen(false)
  }, [])

  const setTopic = useCallback((topicId: string) => {
    if (currentTopicId && currentTopicId !== topicId) {
      setHistory(h => [...h, currentTopicId])
    }
    setCurrentTopicId(topicId)
    setSearchQuery('')
  }, [currentTopicId])

  const search = useCallback((query: string) => {
    setSearchQuery(query)
    if (query) {
      setCurrentTopicId(null)
    }
  }, [])

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1]
      setHistory(h => h.slice(0, -1))
      setCurrentTopicId(prev)
    }
  }, [history])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const value: HelpContextValue = {
    isOpen,
    currentTopic,
    searchQuery,
    history,

    openHelp,
    closeHelp,
    setTopic,
    search,
    goBack,
    clearHistory,

    getTopicById,
    searchTopics,
    getTopicsByCategory,
  }

  return (
    <HelpContext.Provider value={value}>
      {children}
    </HelpContext.Provider>
  )
}
