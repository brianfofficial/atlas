'use client'

import { motion } from 'framer-motion'
import {
  Key,
  Shield,
  Terminal,
  DollarSign,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface GettingStartedStep {
  id: string
  title: string
  description: string
  href: string
  icon: typeof Key
  completed: boolean
}

interface GettingStartedProps {
  steps: GettingStartedStep[]
  className?: string
}

/**
 * Getting Started Cards Component
 *
 * Shows a guided experience for new users.
 */
export function GettingStarted({ steps, className }: GettingStartedProps) {
  const completedCount = steps.filter((s) => s.completed).length
  const progress = (completedCount / steps.length) * 100

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Getting Started</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {completedCount}/{steps.length} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-background-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-primary rounded-full"
        />
      </div>

      {/* Steps */}
      <div className="grid gap-3 md:grid-cols-2">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              href={step.href}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border transition-all',
                step.completed
                  ? 'bg-success/5 border-success/20'
                  : 'bg-background-secondary border-border hover:border-primary/50'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  step.completed
                    ? 'bg-success/20 text-success'
                    : 'bg-background-tertiary text-muted-foreground'
                )}
              >
                {step.completed ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'font-medium text-sm',
                    step.completed && 'text-success'
                  )}
                >
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {step.description}
                </div>
              </div>

              {!step.completed && (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Completed message */}
      {completedCount === steps.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-4 rounded-lg bg-success/10 border border-success/20 text-success text-sm"
        >
          <Check className="w-4 h-4" />
          <span>Great job! You've completed the setup.</span>
        </motion.div>
      )}
    </div>
  )
}

/**
 * Default getting started steps
 */
export function getDefaultGettingStartedSteps(options: {
  hasCredentials: boolean
  hasMFA: boolean
  hasRunCommand: boolean
  hasBudget: boolean
}): GettingStartedStep[] {
  return [
    {
      id: 'mfa',
      title: 'Set up two-step login',
      description: 'Add an extra layer of security',
      href: '/setup-mfa',
      icon: Shield,
      completed: options.hasMFA,
    },
    {
      id: 'credential',
      title: 'Add a credential',
      description: 'Connect to your first service',
      href: '/security/credentials',
      icon: Key,
      completed: options.hasCredentials,
    },
    {
      id: 'command',
      title: 'Run a command',
      description: 'Try the sandbox environment',
      href: '/sandbox',
      icon: Terminal,
      completed: options.hasRunCommand,
    },
    {
      id: 'budget',
      title: 'Set a budget',
      description: 'Control your AI usage costs',
      href: '/costs/budget',
      icon: DollarSign,
      completed: options.hasBudget,
    },
  ]
}
