'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Check,
  AlertTriangle,
  X,
  ChevronDown,
  Lock,
  Key,
  Box,
  Eye,
  Zap,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface SecurityFactor {
  id: string
  name: string
  description: string
  icon: typeof Shield
  status: 'enabled' | 'warning' | 'disabled'
  points: number
  maxPoints: number
  recommendation?: string
}

interface SecurityScoreExplainerProps {
  score: number
  factors: SecurityFactor[]
  className?: string
}

const statusColors = {
  enabled: 'text-success',
  warning: 'text-warning',
  disabled: 'text-danger',
}

const statusBgColors = {
  enabled: 'bg-success/10',
  warning: 'bg-warning/10',
  disabled: 'bg-danger/10',
}

const statusIcons = {
  enabled: Check,
  warning: AlertTriangle,
  disabled: X,
}

/**
 * Security Score Explainer
 *
 * Breaks down the security score with explanations.
 */
export function SecurityScoreExplainer({
  score,
  factors,
  className,
}: SecurityScoreExplainerProps) {
  const [expanded, setExpanded] = useState(false)

  const scoreColor =
    score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger'
  const scoreBg =
    score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-danger'

  const enabledCount = factors.filter((f) => f.status === 'enabled').length
  const warningCount = factors.filter((f) => f.status === 'warning').length
  const disabledCount = factors.filter((f) => f.status === 'disabled').length

  return (
    <div className={cn('rounded-xl border border-border bg-background-secondary', className)}>
      {/* Score header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-background-tertiary transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Score circle */}
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-background-tertiary"
              />
              <motion.circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                className={scoreBg}
                initial={{ strokeDashoffset: 176 }}
                animate={{ strokeDashoffset: 176 - (176 * score) / 100 }}
                strokeDasharray="176"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn('text-xl font-bold', scoreColor)}>{score}</span>
            </div>
          </div>

          <div className="text-left">
            <div className="font-semibold">Security Score</div>
            <div className="text-sm text-muted-foreground">
              {enabledCount} protected, {warningCount} warnings, {disabledCount} issues
            </div>
          </div>
        </div>

        <ChevronDown
          className={cn(
            'w-5 h-5 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3">
              {factors.map((factor) => {
                const StatusIcon = statusIcons[factor.status]
                return (
                  <div
                    key={factor.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-background"
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                        statusBgColors[factor.status]
                      )}
                    >
                      <StatusIcon className={cn('w-4 h-4', statusColors[factor.status])} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{factor.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {factor.points}/{factor.maxPoints} pts
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {factor.description}
                      </p>
                      {factor.recommendation && factor.status !== 'enabled' && (
                        <p className={cn('text-xs mt-2', statusColors[factor.status])}>
                          → {factor.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Get default security factors for the score
 */
export function getDefaultSecurityFactors(options: {
  hasEncryption: boolean
  hasMFA: boolean
  hasSandbox: boolean
  hasAllowlist: boolean
  hasZeroTrust: boolean
  hasRateLimiting: boolean
  credentialsNeedRotation: number
}): SecurityFactor[] {
  return [
    {
      id: 'encryption',
      name: 'Credential Encryption',
      description: 'Your passwords are encrypted with AES-256-GCM',
      icon: Lock,
      status: options.hasEncryption ? 'enabled' : 'disabled',
      points: options.hasEncryption ? 20 : 0,
      maxPoints: 20,
      recommendation: 'Enable credential encryption to protect your API keys',
    },
    {
      id: 'mfa',
      name: 'Two-Step Login',
      description: 'Extra verification using your phone',
      icon: Key,
      status: options.hasMFA ? 'enabled' : 'disabled',
      points: options.hasMFA ? 20 : 0,
      maxPoints: 20,
      recommendation: 'Enable MFA to protect against password theft',
    },
    {
      id: 'sandbox',
      name: 'Sandbox Execution',
      description: 'Commands run in isolated containers',
      icon: Box,
      status: options.hasSandbox ? 'enabled' : 'disabled',
      points: options.hasSandbox ? 20 : 0,
      maxPoints: 20,
      recommendation: 'Enable Docker sandbox for safe command execution',
    },
    {
      id: 'allowlist',
      name: 'Command Allowlist',
      description: 'Only approved commands can run',
      icon: Check,
      status: options.hasAllowlist ? 'enabled' : 'warning',
      points: options.hasAllowlist ? 15 : 5,
      maxPoints: 15,
      recommendation: 'Review and restrict the command allowlist',
    },
    {
      id: 'zero-trust',
      name: 'Zero Trust Network',
      description: 'All connections are verified',
      icon: Eye,
      status: options.hasZeroTrust ? 'enabled' : 'warning',
      points: options.hasZeroTrust ? 15 : 5,
      maxPoints: 15,
      recommendation: 'Enable IP allowlisting for stricter access',
    },
    {
      id: 'rate-limiting',
      name: 'Rate Limiting',
      description: 'Protection against flooding attacks',
      icon: Zap,
      status: options.hasRateLimiting ? 'enabled' : 'warning',
      points: options.hasRateLimiting ? 10 : 5,
      maxPoints: 10,
      recommendation: 'Configure stricter rate limits',
    },
  ]
}

/**
 * Calculate security score from factors
 */
export function calculateSecurityScore(factors: SecurityFactor[]): number {
  const total = factors.reduce((sum, f) => sum + f.points, 0)
  const max = factors.reduce((sum, f) => sum + f.maxPoints, 0)
  return Math.round((total / max) * 100)
}
