'use client'

import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ChevronRight,
  Shield,
  Key,
  Clock,
  RefreshCw,
  Lock,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SecurityRecommendation {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  action: string
  href?: string
  onDismiss?: () => void
  canDismiss?: boolean
}

interface SecurityRecommendationsProps {
  recommendations: SecurityRecommendation[]
  className?: string
}

const severityColors = {
  critical: 'border-danger bg-danger/5',
  high: 'border-danger/50 bg-danger/5',
  medium: 'border-warning bg-warning/5',
  low: 'border-primary/50 bg-primary/5',
}

const severityTextColors = {
  critical: 'text-danger',
  high: 'text-danger',
  medium: 'text-warning',
  low: 'text-primary',
}

const severityLabels = {
  critical: 'Critical',
  high: 'High Priority',
  medium: 'Recommended',
  low: 'Optional',
}

/**
 * Security Recommendations Component
 *
 * Shows actionable security improvements.
 */
export function SecurityRecommendations({
  recommendations,
  className,
}: SecurityRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20',
          className
        )}
      >
        <Shield className="w-5 h-5 text-success" />
        <div>
          <div className="font-medium text-success">All good!</div>
          <div className="text-sm text-success/80">
            No security recommendations at this time.
          </div>
        </div>
      </motion.div>
    )
  }

  // Sort by severity
  const sorted = [...recommendations].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="w-4 h-4" />
        <span>{recommendations.length} recommendations</span>
      </div>

      {sorted.map((rec, index) => (
        <motion.div
          key={rec.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className={cn(
            'flex items-start gap-4 p-4 rounded-lg border',
            severityColors[rec.severity]
          )}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-xs font-medium', severityTextColors[rec.severity])}>
                {severityLabels[rec.severity]}
              </span>
            </div>
            <div className="font-medium text-sm">{rec.title}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {rec.description}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {rec.href ? (
              <Link href={rec.href}>
                <Button size="sm" variant="outline" className="gap-1">
                  {rec.action}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="outline">
                {rec.action}
              </Button>
            )}

            {rec.canDismiss && rec.onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={rec.onDismiss}
                className="text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/**
 * Generate recommendations based on security state
 */
export function generateRecommendations(state: {
  hasMFA: boolean
  credentialsNeedRotation: number
  hasOldCredentials: boolean
  unusedCredentials: number
  hasExposedPorts: boolean
  pendingApprovals: number
}): SecurityRecommendation[] {
  const recommendations: SecurityRecommendation[] = []

  if (!state.hasMFA) {
    recommendations.push({
      id: 'enable-mfa',
      severity: 'critical',
      title: 'Enable two-step login',
      description: 'Your account only uses a password. Add phone verification for better protection.',
      action: 'Set up now',
      href: '/setup-mfa',
    })
  }

  if (state.credentialsNeedRotation > 0) {
    recommendations.push({
      id: 'rotate-credentials',
      severity: state.credentialsNeedRotation > 3 ? 'high' : 'medium',
      title: `${state.credentialsNeedRotation} credentials need rotation`,
      description: 'Old credentials should be refreshed to maintain security.',
      action: 'Review',
      href: '/security/credentials',
    })
  }

  if (state.unusedCredentials > 0) {
    recommendations.push({
      id: 'remove-unused',
      severity: 'low',
      title: `${state.unusedCredentials} unused credentials`,
      description: 'Consider removing credentials you no longer use.',
      action: 'Review',
      href: '/security/credentials',
      canDismiss: true,
    })
  }

  if (state.hasExposedPorts) {
    recommendations.push({
      id: 'check-network',
      severity: 'high',
      title: 'Network exposure detected',
      description: 'Atlas may be accessible from the internet. Review your network settings.',
      action: 'Check settings',
      href: '/settings/network',
    })
  }

  if (state.pendingApprovals > 5) {
    recommendations.push({
      id: 'pending-approvals',
      severity: 'medium',
      title: `${state.pendingApprovals} pending approvals`,
      description: 'Review and process pending approval requests.',
      action: 'Review',
      href: '/approvals',
    })
  }

  return recommendations
}
