'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  label: string
  description?: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function StepIndicator({
  steps,
  currentStep,
  className,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status =
            index < currentStep
              ? 'complete'
              : index === currentStep
                ? 'current'
                : 'upcoming'

          return (
            <li key={step.label} className="relative flex-1">
              {/* Connector line */}
              {index !== 0 && (
                <div
                  className={cn(
                    'absolute left-0 top-4 -ml-px h-0.5 w-full -translate-y-1/2',
                    status === 'upcoming'
                      ? 'bg-muted'
                      : 'bg-primary'
                  )}
                  aria-hidden="true"
                />
              )}

              <div className="relative flex flex-col items-center group">
                {/* Step circle */}
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background transition-colors',
                    status === 'complete'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : status === 'current'
                        ? 'border-primary text-primary animate-pulse-glow'
                        : 'border-muted text-muted-foreground'
                  )}
                >
                  {status === 'complete' ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </span>

                {/* Step label */}
                <span
                  className={cn(
                    'mt-2 text-xs font-medium text-center max-w-[80px]',
                    status === 'current'
                      ? 'text-primary'
                      : status === 'complete'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
