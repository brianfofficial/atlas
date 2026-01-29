'use client'

import { AlertTriangle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DemoBannerProps {
  feature: string
  description?: string
  className?: string
  variant?: 'warning' | 'info'
}

/**
 * Banner to indicate a feature is showing demo data
 * Use this on pages that display mock/placeholder data
 */
export function DemoBanner({
  feature,
  description,
  className,
  variant = 'warning',
}: DemoBannerProps) {
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 flex items-start gap-3',
        variant === 'warning'
          ? 'bg-warning/10 border-warning/20 text-warning-foreground'
          : 'bg-primary/10 border-primary/20 text-primary-foreground',
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-warning" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">
          {feature} - Demo Mode
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {description ||
            'This feature is showing demo data. Connect your integrations to see real information.'}
        </p>
      </div>
    </div>
  )
}

interface ComingSoonProps {
  feature: string
  description?: string
  className?: string
  showIcon?: boolean
}

/**
 * Full-page coming soon placeholder
 * Use when a feature is not yet implemented
 */
export function ComingSoon({
  feature,
  description,
  className,
  showIcon = true,
}: ComingSoonProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      {showIcon && (
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h2 className="text-xl font-semibold mb-2">{feature}</h2>
      <p className="text-muted-foreground max-w-md">
        {description || 'This feature is coming soon. Check back later for updates.'}
      </p>
    </div>
  )
}

interface IntegrationRequiredProps {
  integration: string
  feature: string
  onConnect?: () => void
  className?: string
}

/**
 * Prompt to connect an integration
 * Use when a feature requires OAuth/API connection
 */
export function IntegrationRequired({
  integration,
  feature,
  onConnect,
  className,
}: IntegrationRequiredProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-muted-foreground/25 px-6 py-8 flex flex-col items-center text-center',
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <ExternalLink className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium mb-1">Connect {integration}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        Connect your {integration} account to see {feature.toLowerCase()} in Atlas.
      </p>
      {onConnect && (
        <button
          onClick={onConnect}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Connect {integration}
        </button>
      )}
    </div>
  )
}
