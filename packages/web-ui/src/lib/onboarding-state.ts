/**
 * Onboarding State Management
 *
 * Tracks user progress through the onboarding flow and
 * determines when to show getting-started prompts.
 */

export interface OnboardingProgress {
  completedSteps: OnboardingStep[]
  currentStep: OnboardingStep | null
  startedAt: Date | null
  completedAt: Date | null
  skippedSteps: OnboardingStep[]
  version: number // For migrating saved state
}

export type OnboardingStep =
  | 'welcome'
  | 'security-explainer'
  | 'first-credential'
  | 'first-command'
  | 'completion'

export interface StepInfo {
  id: OnboardingStep
  title: string
  description: string
  duration: string // Estimated time
  optional: boolean
}

export const ONBOARDING_STEPS: StepInfo[] = [
  {
    id: 'welcome',
    title: 'Welcome to Atlas',
    description: 'Learn what Atlas can do for you',
    duration: '1 min',
    optional: false,
  },
  {
    id: 'security-explainer',
    title: 'How we keep you safe',
    description: 'Understand your security protections',
    duration: '2 min',
    optional: false,
  },
  {
    id: 'first-credential',
    title: 'Add your first connection',
    description: 'Connect Atlas to a service you use',
    duration: '2 min',
    optional: false,
  },
  {
    id: 'first-command',
    title: 'Try your first command',
    description: 'Run a simple task in the safe environment',
    duration: '1 min',
    optional: true,
  },
  {
    id: 'completion',
    title: 'You\'re ready!',
    description: 'Start using Atlas with confidence',
    duration: '1 min',
    optional: false,
  },
]

const STORAGE_KEY = 'atlas-onboarding-progress'
const CURRENT_VERSION = 1

/**
 * Default state for new users
 */
export function getDefaultProgress(): OnboardingProgress {
  return {
    completedSteps: [],
    currentStep: null,
    startedAt: null,
    completedAt: null,
    skippedSteps: [],
    version: CURRENT_VERSION,
  }
}

/**
 * Load onboarding progress from localStorage
 */
export function loadOnboardingProgress(): OnboardingProgress {
  if (typeof window === 'undefined') {
    return getDefaultProgress()
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return getDefaultProgress()
    }

    const parsed = JSON.parse(stored) as OnboardingProgress

    // Migrate old versions if needed
    if (parsed.version !== CURRENT_VERSION) {
      return migrateProgress(parsed)
    }

    // Reconstruct dates
    return {
      ...parsed,
      startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
      completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null,
    }
  } catch {
    return getDefaultProgress()
  }
}

/**
 * Save onboarding progress to localStorage
 */
export function saveOnboardingProgress(progress: OnboardingProgress): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Migrate from older versions of saved state
 */
function migrateProgress(old: Partial<OnboardingProgress>): OnboardingProgress {
  // For now, just reset if version mismatch
  return getDefaultProgress()
}

/**
 * Mark a step as completed
 */
export function completeStep(
  progress: OnboardingProgress,
  step: OnboardingStep
): OnboardingProgress {
  if (progress.completedSteps.includes(step)) {
    return progress
  }

  const updated: OnboardingProgress = {
    ...progress,
    completedSteps: [...progress.completedSteps, step],
    currentStep: getNextStep(progress.completedSteps, step),
  }

  // Check if onboarding is complete
  const requiredSteps = ONBOARDING_STEPS.filter(s => !s.optional).map(s => s.id)
  const allRequiredComplete = requiredSteps.every(s => updated.completedSteps.includes(s))

  if (allRequiredComplete) {
    updated.completedAt = new Date()
    updated.currentStep = null
  }

  return updated
}

/**
 * Skip a step (only optional steps can be skipped)
 */
export function skipStep(
  progress: OnboardingProgress,
  step: OnboardingStep
): OnboardingProgress {
  const stepInfo = ONBOARDING_STEPS.find(s => s.id === step)
  if (!stepInfo?.optional) {
    return progress
  }

  if (progress.skippedSteps.includes(step)) {
    return progress
  }

  return {
    ...progress,
    skippedSteps: [...progress.skippedSteps, step],
    currentStep: getNextStep(progress.completedSteps, step),
  }
}

/**
 * Start the onboarding flow
 */
export function startOnboarding(progress: OnboardingProgress): OnboardingProgress {
  if (progress.startedAt) {
    return progress
  }

  return {
    ...progress,
    startedAt: new Date(),
    currentStep: 'welcome',
  }
}

/**
 * Reset onboarding progress (for testing or re-onboarding)
 */
export function resetOnboarding(): OnboardingProgress {
  const fresh = getDefaultProgress()
  saveOnboardingProgress(fresh)
  return fresh
}

/**
 * Get the next step after completing one
 */
function getNextStep(
  completed: OnboardingStep[],
  justCompleted: OnboardingStep
): OnboardingStep | null {
  const currentIndex = ONBOARDING_STEPS.findIndex(s => s.id === justCompleted)
  if (currentIndex === -1 || currentIndex >= ONBOARDING_STEPS.length - 1) {
    return null
  }

  const nextStep = ONBOARDING_STEPS[currentIndex + 1]
  return nextStep.id
}

/**
 * Calculate onboarding progress percentage
 */
export function getProgressPercentage(progress: OnboardingProgress): number {
  const requiredSteps = ONBOARDING_STEPS.filter(s => !s.optional)
  const completedRequired = requiredSteps.filter(s =>
    progress.completedSteps.includes(s.id)
  )
  return Math.round((completedRequired.length / requiredSteps.length) * 100)
}

/**
 * Check if user should see onboarding modal
 */
export function shouldShowOnboarding(progress: OnboardingProgress): boolean {
  // Don't show if already completed
  if (progress.completedAt) {
    return false
  }

  // Don't show if user hasn't started yet (will start after first login)
  if (!progress.startedAt) {
    return false
  }

  // Show if there are uncompleted required steps
  const requiredSteps = ONBOARDING_STEPS.filter(s => !s.optional)
  return !requiredSteps.every(s => progress.completedSteps.includes(s.id))
}

/**
 * Check if this is a new user (never started onboarding)
 */
export function isNewUser(progress: OnboardingProgress): boolean {
  return !progress.startedAt
}

/**
 * Get friendly display info for a step
 */
export function getStepInfo(step: OnboardingStep): StepInfo | undefined {
  return ONBOARDING_STEPS.find(s => s.id === step)
}

/**
 * Get steps remaining (excludes optional steps)
 */
export function getStepsRemaining(progress: OnboardingProgress): StepInfo[] {
  return ONBOARDING_STEPS.filter(
    s =>
      !s.optional &&
      !progress.completedSteps.includes(s.id) &&
      !progress.skippedSteps.includes(s.id)
  )
}
