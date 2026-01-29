'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { OnboardingStep, ONBOARDING_STEPS, OnboardingProgress } from '@/lib/onboarding-state'
import { WelcomeStep } from './welcome-step'
import { SecurityExplainerStep } from './security-explainer'
import { FirstCredentialStep } from './first-credential-step'
import { FirstCommandStep } from './first-command-step'
import { CompletionStep } from './completion-step'

interface OnboardingModalProps {
  open: boolean
  onClose: () => void
  progress: OnboardingProgress
  onComplete: (step: OnboardingStep) => void
  onSkip: (step: OnboardingStep) => void
}

/**
 * Onboarding Modal
 *
 * A 5-step guided experience for new users.
 * Uses Framer Motion for smooth transitions between steps.
 */
export function OnboardingModal({
  open,
  onClose,
  progress,
  onComplete,
  onSkip,
}: OnboardingModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Find the current step based on progress
  useEffect(() => {
    if (!open) return

    const nextIncompleteIndex = ONBOARDING_STEPS.findIndex(
      (step) =>
        !progress.completedSteps.includes(step.id) &&
        !progress.skippedSteps.includes(step.id)
    )

    if (nextIncompleteIndex !== -1) {
      setCurrentStepIndex(nextIncompleteIndex)
    }
  }, [open, progress.completedSteps, progress.skippedSteps])

  const currentStep = ONBOARDING_STEPS[currentStepIndex]
  const isLastStep = currentStepIndex === ONBOARDING_STEPS.length - 1
  const progressPercent = ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100

  const handleNext = () => {
    if (currentStep) {
      onComplete(currentStep.id)
    }

    if (isLastStep) {
      onClose()
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, ONBOARDING_STEPS.length - 1))
    }
  }

  const handleSkip = () => {
    if (currentStep?.optional) {
      onSkip(currentStep.id)
      setCurrentStepIndex((prev) => Math.min(prev + 1, ONBOARDING_STEPS.length - 1))
    }
  }

  const handleBack = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const renderStep = () => {
    switch (currentStep?.id) {
      case 'welcome':
        return <WelcomeStep />
      case 'security-explainer':
        return <SecurityExplainerStep />
      case 'first-credential':
        return <FirstCredentialStep onComplete={handleNext} />
      case 'first-command':
        return <FirstCommandStep onComplete={handleNext} />
      case 'completion':
        return <CompletionStep />
      default:
        return null
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={(e) => {
              // Only close on direct backdrop click, not bubbled events
              if (e.target === e.currentTarget) {
                // Don't allow closing during onboarding
              }
            }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Progress bar */}
              <div className="px-6 pt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>
                    Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
                  </span>
                  <span>{currentStep?.duration}</span>
                </div>
                <Progress value={progressPercent} className="h-1" />
              </div>

              {/* Close button - only show after first step */}
              {currentStepIndex > 0 && (
                <div className="absolute top-4 right-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </div>
              )}

              {/* Step content with animation */}
              <div className="px-6 py-6 min-h-[300px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep?.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation buttons */}
              <div className="px-6 pb-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    {currentStepIndex > 0 && (
                      <Button variant="ghost" onClick={handleBack}>
                        Back
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {currentStep?.optional && (
                      <Button variant="ghost" onClick={handleSkip}>
                        Skip for now
                      </Button>
                    )}
                    <Button onClick={handleNext}>
                      {isLastStep ? 'Get Started' : 'Continue'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step indicators */}
              <div className="px-6 pb-4">
                <div className="flex items-center justify-center gap-1.5">
                  {ONBOARDING_STEPS.map((step, index) => (
                    <button
                      key={step.id}
                      onClick={() => {
                        // Only allow going back to completed steps
                        if (progress.completedSteps.includes(step.id)) {
                          setCurrentStepIndex(index)
                        }
                      }}
                      className={cn(
                        'w-2 h-2 rounded-full transition-colors',
                        index === currentStepIndex
                          ? 'bg-primary'
                          : progress.completedSteps.includes(step.id)
                            ? 'bg-primary/50 cursor-pointer hover:bg-primary/70'
                            : 'bg-border'
                      )}
                      aria-label={`Go to ${step.title}`}
                      disabled={
                        !progress.completedSteps.includes(step.id) &&
                        index !== currentStepIndex
                      }
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
