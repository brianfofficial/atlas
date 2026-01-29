'use client'

import * as React from 'react'
import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { getTranslation, translate } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { useHelp } from '@/hooks/use-help'

interface ContextualHelpProps {
  /**
   * The technical term to explain.
   * Will be translated to plain language automatically.
   */
  term: string

  /**
   * Optional custom plain-language text.
   * If not provided, will use the translations library.
   */
  plainText?: string

  /**
   * Optional custom description.
   * If not provided, will use the translations library.
   */
  description?: string

  /**
   * Size of the help icon
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Show the term inline with a help icon
   */
  showTerm?: boolean

  /**
   * Additional class name for the wrapper
   */
  className?: string

  /**
   * Optional help topic ID to link to
   */
  helpTopicId?: string
}

/**
 * Contextual Help Component
 *
 * Provides tooltip-based explanations for technical terms.
 * Uses the translations library for automatic term mapping.
 *
 * Usage:
 * ```tsx
 * <ContextualHelp term="aes-256-gcm" />
 *
 * // With custom text
 * <ContextualHelp
 *   term="sandbox"
 *   description="Commands run in complete isolation"
 * />
 *
 * // Show the term inline
 * <ContextualHelp term="mfa" showTerm />
 * ```
 */
export function ContextualHelp({
  term,
  plainText,
  description,
  size = 'sm',
  showTerm = false,
  className,
  helpTopicId,
}: ContextualHelpProps) {
  const translation = getTranslation(term)
  const { openHelp } = useHelp()

  const displayPlain = plainText ?? translation?.plain ?? translate(term)
  const displayDescription = description ?? translation?.description ?? ''
  const icon = translation?.icon

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const handleClick = () => {
    if (helpTopicId) {
      openHelp(helpTopicId)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded text-muted-foreground hover:text-foreground transition-colors',
              helpTopicId && 'cursor-help',
              className
            )}
            onClick={handleClick}
          >
            {showTerm && (
              <span className="text-foreground">
                {icon && <span className="mr-1">{icon}</span>}
                {displayPlain}
              </span>
            )}
            <HelpCircle
              className={cn(iconSizes[size], 'shrink-0')}
              aria-hidden="true"
            />
            <span className="sr-only">Help: {displayPlain}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="max-w-xs bg-background-secondary border border-border p-3 text-foreground"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {icon && <span>{icon}</span>}
              <span className="font-medium">{displayPlain}</span>
            </div>
            {displayDescription && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {displayDescription}
              </p>
            )}
            {helpTopicId && (
              <p className="text-xs text-primary pt-1">
                Click for more details
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface HelpLabelProps {
  /**
   * The label text (can be technical or plain)
   */
  children: React.ReactNode

  /**
   * The technical term to explain in the tooltip
   */
  term: string

  /**
   * Optional custom description
   */
  description?: string

  /**
   * Additional class name
   */
  className?: string

  /**
   * Help topic ID for deep linking
   */
  helpTopicId?: string
}

/**
 * A label with attached contextual help
 *
 * Usage:
 * ```tsx
 * <HelpLabel term="aes-256-gcm">
 *   Encryption Method
 * </HelpLabel>
 * ```
 */
export function HelpLabel({
  children,
  term,
  description,
  className,
  helpTopicId,
}: HelpLabelProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span>{children}</span>
      <ContextualHelp
        term={term}
        description={description}
        helpTopicId={helpTopicId}
      />
    </div>
  )
}

interface TranslatedTermProps {
  /**
   * The technical term to translate
   */
  term: string

  /**
   * Show the help icon
   */
  showHelp?: boolean

  /**
   * Additional class name
   */
  className?: string
}

/**
 * Displays a technical term translated to plain language
 *
 * Usage:
 * ```tsx
 * // Just the translated text
 * <TranslatedTerm term="totp" />
 * // Output: "Phone verification code"
 *
 * // With help icon
 * <TranslatedTerm term="totp" showHelp />
 * ```
 */
export function TranslatedTerm({
  term,
  showHelp = false,
  className,
}: TranslatedTermProps) {
  const translation = getTranslation(term)
  const displayText = translation?.plain ?? translate(term)
  const icon = translation?.icon

  if (showHelp) {
    return <ContextualHelp term={term} showTerm className={className} />
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {icon && <span>{icon}</span>}
      {displayText}
    </span>
  )
}

interface SecurityBadgeProps {
  /**
   * The security feature to display
   */
  feature:
    | 'encryption'
    | 'mfa'
    | 'sandbox'
    | 'allowlist'
    | 'zero-trust'
    | 'rate-limiting'

  /**
   * Show as enabled or just informational
   */
  enabled?: boolean

  /**
   * Additional class name
   */
  className?: string
}

const featureTerms: Record<SecurityBadgeProps['feature'], string> = {
  encryption: 'aes-256-gcm',
  mfa: 'mfa',
  sandbox: 'sandbox',
  allowlist: 'allowlist',
  'zero-trust': 'zero-trust',
  'rate-limiting': 'rate-limiting',
}

const featureLabels: Record<SecurityBadgeProps['feature'], string> = {
  encryption: 'Bank-level encryption',
  mfa: 'Two-step login',
  sandbox: 'Safe environment',
  allowlist: 'Approved commands only',
  'zero-trust': 'Verify everything',
  'rate-limiting': 'Rate protected',
}

/**
 * A badge showing a security feature with contextual help
 *
 * Usage:
 * ```tsx
 * <SecurityBadge feature="encryption" enabled />
 * <SecurityBadge feature="mfa" />
 * ```
 */
export function SecurityBadge({
  feature,
  enabled = true,
  className,
}: SecurityBadgeProps) {
  const term = featureTerms[feature]
  const label = featureLabels[feature]
  const translation = getTranslation(term)

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        enabled
          ? 'bg-success/10 text-success'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {translation?.icon && <span>{translation.icon}</span>}
      <span>{label}</span>
      <ContextualHelp term={term} size="sm" />
    </div>
  )
}
