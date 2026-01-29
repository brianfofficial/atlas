'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  OnboardingProgress,
  OnboardingStep,
  loadOnboardingProgress,
  saveOnboardingProgress,
  completeStep,
  skipStep,
  startOnboarding,
  resetOnboarding,
  getProgressPercentage,
  shouldShowOnboarding,
  isNewUser,
  getStepsRemaining,
  getStepInfo,
  ONBOARDING_STEPS,
} from '@/lib/onboarding-state'

export interface UseOnboardingReturn {
  // State
  progress: OnboardingProgress
  isLoading: boolean
  isOpen: boolean
  currentStep: OnboardingStep | null
  progressPercent: number
  stepsRemaining: ReturnType<typeof getStepsRemaining>

  // Actions
  start: () => void
  complete: (step: OnboardingStep) => void
  skip: (step: OnboardingStep) => void
  reset: () => void
  openModal: () => void
  closeModal: () => void

  // Queries
  isNewUser: boolean
  isComplete: boolean
  getStepInfo: typeof getStepInfo
  allSteps: typeof ONBOARDING_STEPS
}

/**
 * Hook for managing onboarding state
 *
 * Usage:
 * ```tsx
 * function DashboardLayout({ children }) {
 *   const onboarding = useOnboarding()
 *
 *   // Auto-start for new users
 *   useEffect(() => {
 *     if (onboarding.isNewUser) {
 *       onboarding.start()
 *       onboarding.openModal()
 *     }
 *   }, [onboarding.isNewUser])
 *
 *   return (
 *     <>
 *       {children}
 *       <OnboardingModal
 *         open={onboarding.isOpen}
 *         onClose={onboarding.closeModal}
 *         progress={onboarding.progress}
 *         onComplete={onboarding.complete}
 *         onSkip={onboarding.skip}
 *       />
 *     </>
 *   )
 * }
 * ```
 */
export function useOnboarding(): UseOnboardingReturn {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  // Load progress from localStorage on mount
  useEffect(() => {
    const loaded = loadOnboardingProgress()
    setProgress(loaded)
    setIsLoading(false)

    // Auto-open for users in the middle of onboarding
    if (shouldShowOnboarding(loaded)) {
      setIsOpen(true)
    }
  }, [])

  // Persist changes to localStorage
  const updateProgress = useCallback((newProgress: OnboardingProgress) => {
    setProgress(newProgress)
    saveOnboardingProgress(newProgress)
  }, [])

  const start = useCallback(() => {
    if (!progress) return
    updateProgress(startOnboarding(progress))
  }, [progress, updateProgress])

  const complete = useCallback(
    (step: OnboardingStep) => {
      if (!progress) return
      const updated = completeStep(progress, step)
      updateProgress(updated)

      // Close modal when complete
      if (updated.completedAt) {
        setIsOpen(false)
      }
    },
    [progress, updateProgress]
  )

  const skip = useCallback(
    (step: OnboardingStep) => {
      if (!progress) return
      updateProgress(skipStep(progress, step))
    },
    [progress, updateProgress]
  )

  const reset = useCallback(() => {
    const fresh = resetOnboarding()
    setProgress(fresh)
    setIsOpen(false)
  }, [])

  const openModal = useCallback(() => setIsOpen(true), [])
  const closeModal = useCallback(() => setIsOpen(false), [])

  // Compute derived state
  const currentProgress = progress ?? {
    completedSteps: [],
    currentStep: null,
    startedAt: null,
    completedAt: null,
    skippedSteps: [],
    version: 1,
  }

  return {
    progress: currentProgress,
    isLoading,
    isOpen,
    currentStep: currentProgress.currentStep,
    progressPercent: getProgressPercentage(currentProgress),
    stepsRemaining: getStepsRemaining(currentProgress),

    start,
    complete,
    skip,
    reset,
    openModal,
    closeModal,

    isNewUser: isNewUser(currentProgress),
    isComplete: Boolean(currentProgress.completedAt),
    getStepInfo,
    allSteps: ONBOARDING_STEPS,
  }
}

/**
 * Helper to check if a specific step is complete
 */
export function useStepComplete(step: OnboardingStep): boolean {
  const { progress } = useOnboarding()
  return progress.completedSteps.includes(step)
}

/**
 * Helper to trigger a step completion when a condition is met
 * Useful for auto-completing steps when user takes action
 */
export function useAutoCompleteStep(
  step: OnboardingStep,
  condition: boolean
): void {
  const { progress, complete } = useOnboarding()

  useEffect(() => {
    if (condition && !progress.completedSteps.includes(step)) {
      complete(step)
    }
  }, [condition, step, progress.completedSteps, complete])
}
