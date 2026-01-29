'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorRecoveryProps {
  /**
   * Title for the error
   */
  title: string

  /**
   * User-friendly description of what went wrong
   */
  description: string

  /**
   * List of recovery steps the user can try
   */
  recoverySteps?: string[]

  /**
   * Optional error details to show (for support)
   */
  errorId?: string

  /**
   * Retry callback
   */
  onRetry?: () => void

  /**
   * Go back callback
   */
  onGoBack?: () => void

  /**
   * Contact support URL
   */
  supportUrl?: string

  /**
   * Additional class name
   */
  className?: string
}

/**
 * Error Recovery Component
 *
 * A full-page error display with recovery steps and support options.
 * Provides clear guidance on what to do next.
 */
export function ErrorRecovery({
  title,
  description,
  recoverySteps,
  errorId,
  onRetry,
  onGoBack,
  supportUrl = 'https://docs.atlas.dev/support',
  className,
}: ErrorRecoveryProps) {
  const [copied, setCopied] = useState(false)

  const copyErrorId = async () => {
    if (!errorId) return
    await navigator.clipboard.writeText(errorId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'min-h-[400px] flex flex-col items-center justify-center p-8',
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger/10 mb-6"
        >
          <AlertCircle className="w-8 h-8 text-danger" />
        </motion.div>

        {/* Title & Description */}
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground mb-6">{description}</p>

        {/* Recovery steps */}
        {recoverySteps && recoverySteps.length > 0 && (
          <div className="text-left mb-6 p-4 rounded-lg bg-background-secondary">
            <h2 className="text-sm font-medium mb-3">Things to try:</h2>
            <ol className="space-y-2">
              {recoverySteps.map((step, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex items-start gap-3 text-sm"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </motion.li>
              ))}
            </ol>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mb-6">
          {onRetry && (
            <Button onClick={onRetry} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          )}
          {onGoBack && (
            <Button variant="outline" onClick={onGoBack} className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          )}
          {supportUrl && (
            <Button
              variant="ghost"
              asChild
              className="w-full gap-2 text-muted-foreground"
            >
              <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                <HelpCircle className="w-4 h-4" />
                Get Help
              </a>
            </Button>
          )}
        </div>

        {/* Error ID (for support) */}
        {errorId && (
          <div className="text-xs text-muted-foreground">
            <span>Error ID: </span>
            <button
              onClick={copyErrorId}
              className="font-mono hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              {errorId}
              {copied ? (
                <Check className="w-3 h-3 text-success" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

/**
 * Common error recovery scenarios
 */
export function ConnectionLostRecovery({
  onRetry,
}: {
  onRetry?: () => void
}) {
  return (
    <ErrorRecovery
      title="Connection Lost"
      description="We couldn't reach the server. This is usually temporary."
      recoverySteps={[
        'Check your internet connection',
        'Wait a few moments and try again',
        'If the problem persists, the service may be down',
      ]}
      onRetry={onRetry}
    />
  )
}

export function SomethingWentWrongRecovery({
  errorId,
  onRetry,
  onGoBack,
}: {
  errorId?: string
  onRetry?: () => void
  onGoBack?: () => void
}) {
  return (
    <ErrorRecovery
      title="Something Went Wrong"
      description="An unexpected error occurred. We've logged it for investigation."
      recoverySteps={[
        'Try refreshing the page',
        'Clear your browser cache',
        'If the problem continues, please contact support',
      ]}
      errorId={errorId}
      onRetry={onRetry}
      onGoBack={onGoBack}
    />
  )
}

export function PermissionDeniedRecovery({
  onGoBack,
}: {
  onGoBack?: () => void
}) {
  return (
    <ErrorRecovery
      title="Access Denied"
      description="You don't have permission to access this page."
      recoverySteps={[
        'Make sure you\'re logged in to the right account',
        'Check with your administrator if you should have access',
        'Some features may require a higher plan',
      ]}
      onGoBack={onGoBack}
    />
  )
}

export function NotFoundRecovery({
  onGoBack,
}: {
  onGoBack?: () => void
}) {
  return (
    <ErrorRecovery
      title="Page Not Found"
      description="The page you're looking for doesn't exist or has been moved."
      recoverySteps={[
        'Check the URL for typos',
        'Go back to the previous page',
        'Start fresh from the dashboard',
      ]}
      onGoBack={onGoBack}
    />
  )
}
