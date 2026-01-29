'use client'

import { motion } from 'framer-motion'
import {
  AlertCircle,
  RefreshCw,
  LogIn,
  Key,
  Shield,
  Wifi,
  Clock,
  DollarSign,
  HelpCircle,
  ChevronDown,
  ExternalLink,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { translateError } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { useHelp } from '@/hooks/use-help'

interface HumanizedErrorProps {
  /**
   * The error code (e.g., 'AUTH_REQUIRED', 'SANDBOX_UNAVAILABLE')
   */
  code: string

  /**
   * Optional additional details about the error
   */
  details?: string

  /**
   * Optional technical details (shown when expanded)
   */
  technicalDetails?: string

  /**
   * Optional callback for the action button
   */
  onAction?: () => void

  /**
   * Optional custom action label (overrides default)
   */
  actionLabel?: string

  /**
   * Optional help topic ID for "Learn more"
   */
  helpTopicId?: string

  /**
   * Show as inline alert instead of centered card
   */
  inline?: boolean

  /**
   * Additional class name
   */
  className?: string
}

// Icon mapping for error codes
const errorIcons: Record<string, typeof AlertCircle> = {
  AUTH_REQUIRED: LogIn,
  MFA_REQUIRED: Key,
  MFA_INVALID: Key,
  SESSION_EXPIRED: Clock,
  DEVICE_NOT_TRUSTED: Shield,
  CREDENTIAL_DECRYPT_FAILED: Key,
  SANDBOX_UNAVAILABLE: Shield,
  COMMAND_NOT_ALLOWED: Shield,
  INJECTION_DETECTED: Shield,
  RATE_LIMITED: Clock,
  NETWORK_BLOCKED: Wifi,
  COST_LIMIT_EXCEEDED: DollarSign,
  MODEL_UNAVAILABLE: AlertCircle,
  TIMEOUT: Clock,
}

/**
 * Humanized Error Component
 *
 * Displays error messages in plain language with helpful actions.
 * Translates technical error codes to user-friendly messages.
 */
export function HumanizedError({
  code,
  details,
  technicalDetails,
  onAction,
  actionLabel,
  helpTopicId,
  inline = false,
  className,
}: HumanizedErrorProps) {
  const [showTechnical, setShowTechnical] = useState(false)
  const { openHelp } = useHelp()

  const translation = translateError(code, details)
  const Icon = errorIcons[code] ?? AlertCircle

  const handleAction = () => {
    if (onAction) {
      onAction()
    }
  }

  const handleHelp = () => {
    if (helpTopicId) {
      openHelp(helpTopicId)
    }
  }

  if (inline) {
    return (
      <Alert variant="danger" className={className}>
        <Icon className="h-4 w-4" />
        <AlertTitle>{translation.title}</AlertTitle>
        <AlertDescription className="mt-2">
          {translation.message}
          {(translation.action || helpTopicId) && (
            <div className="flex items-center gap-2 mt-3">
              {translation.action && onAction && (
                <Button size="sm" variant="outline" onClick={handleAction}>
                  {actionLabel ?? translation.action}
                </Button>
              )}
              {helpTopicId && (
                <Button size="sm" variant="ghost" onClick={handleHelp}>
                  <HelpCircle className="w-4 h-4 mr-1" />
                  Learn more
                </Button>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'w-full max-w-md mx-auto p-6 rounded-xl bg-background border border-border shadow-lg',
        className
      )}
    >
      {/* Icon */}
      <div className="flex justify-center mb-4">
        <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-danger" />
        </div>
      </div>

      {/* Title & Message */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold mb-2">{translation.title}</h2>
        <p className="text-sm text-muted-foreground">{translation.message}</p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {translation.action && onAction && (
          <Button onClick={handleAction} className="w-full">
            {actionLabel ?? translation.action}
          </Button>
        )}
        {helpTopicId && (
          <Button variant="outline" onClick={handleHelp} className="w-full gap-2">
            <HelpCircle className="w-4 h-4" />
            Learn more
          </Button>
        )}
      </div>

      {/* Technical details (expandable) */}
      {technicalDetails && (
        <div className="mt-4">
          <button
            onClick={() => setShowTechnical(!showTechnical)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
          >
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-transform',
                showTechnical && 'rotate-180'
              )}
            />
            {showTechnical ? 'Hide' : 'Show'} technical details
          </button>
          {showTechnical && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 p-3 rounded-lg bg-background-secondary text-xs font-mono overflow-x-auto"
            >
              <div className="text-muted-foreground mb-1">Error code: {code}</div>
              <div className="text-muted-foreground whitespace-pre-wrap">
                {technicalDetails}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  )
}

/**
 * Common error pages as components
 */
export function SessionExpiredError({ onLogin }: { onLogin: () => void }) {
  return (
    <HumanizedError
      code="SESSION_EXPIRED"
      onAction={onLogin}
      helpTopicId="what-is-mfa"
    />
  )
}

export function SandboxUnavailableError({ onRetry }: { onRetry?: () => void }) {
  return (
    <HumanizedError
      code="SANDBOX_UNAVAILABLE"
      details="Docker may not be running"
      onAction={onRetry}
      actionLabel="Try Again"
      helpTopicId="what-is-sandbox"
      technicalDetails="Docker daemon is not responding. Ensure Docker Desktop is running and try again."
    />
  )
}

export function RateLimitedError({ retryAfter }: { retryAfter?: number }) {
  return (
    <HumanizedError
      code="RATE_LIMITED"
      details={
        retryAfter ? `Try again in ${retryAfter} seconds` : 'Please wait a moment'
      }
    />
  )
}

export function NetworkBlockedError({ ip }: { ip?: string }) {
  return (
    <HumanizedError
      code="NETWORK_BLOCKED"
      details={ip ? `Connection from ${ip} was blocked` : undefined}
      helpTopicId="zero-trust"
    />
  )
}
