'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  X,
  Clock,
  ChevronDown,
  AlertTriangle,
  FileEdit,
  Trash2,
  Globe,
  Key,
  Terminal,
  Plug,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { ApprovalRequest, RiskLevel, ApprovalCategory } from '@/hooks/use-approvals'

interface ApprovalCardProps {
  approval: ApprovalRequest
  onApprove: (id: string, remember: boolean) => void
  onDeny: (id: string) => void
  isProcessing?: boolean
}

const categoryIcons: Record<ApprovalCategory, typeof FileEdit> = {
  file_write: FileEdit,
  file_delete: Trash2,
  network_call: Globe,
  credential_use: Key,
  dangerous_command: Terminal,
  external_api: Plug,
  system_config: Settings,
}

const categoryLabels: Record<ApprovalCategory, string> = {
  file_write: 'File Write',
  file_delete: 'File Delete',
  network_call: 'Network',
  credential_use: 'Credential',
  dangerous_command: 'Command',
  external_api: 'External API',
  system_config: 'Config',
}

const riskColors: Record<RiskLevel, string> = {
  low: 'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-danger/10 text-danger border-danger/20',
  critical: 'bg-danger/20 text-danger border-danger/40',
}

const riskLabels: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
}

/**
 * Approval Card Component
 *
 * Displays a single approval request with actions.
 */
export function ApprovalCard({
  approval,
  onApprove,
  onDeny,
  isProcessing = false,
}: ApprovalCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [remember, setRemember] = useState(false)

  const Icon = categoryIcons[approval.category]
  const expiresAt = new Date(approval.expiresAt)
  const timeRemaining = Math.max(0, expiresAt.getTime() - Date.now())
  const isExpiringSoon = timeRemaining < 60000 // Less than 1 minute

  return (
    <Card
      className={cn(
        'transition-all',
        isExpiringSoon && 'border-warning animate-pulse'
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
              riskColors[approval.riskLevel]
            )}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{approval.operation}</h3>
              <Badge variant="secondary" className="text-xs">
                {categoryLabels[approval.category]}
              </Badge>
              <Badge className={cn('text-xs border', riskColors[approval.riskLevel])}>
                {riskLabels[approval.riskLevel]}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {approval.context}
            </p>

            {/* Time remaining */}
            <div
              className={cn(
                'flex items-center gap-1 text-xs mt-2',
                isExpiringSoon ? 'text-warning' : 'text-muted-foreground'
              )}
            >
              <Clock className="w-3 h-3" />
              <span>
                Expires {formatRelativeTime(expiresAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Technical details (expandable) */}
        {approval.technicalDetails && (
          <div className="mt-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform',
                  showDetails && 'rotate-180'
                )}
              />
              Technical details
            </button>

            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 p-3 rounded-lg bg-background-secondary text-xs font-mono overflow-x-auto"
              >
                <div className="text-muted-foreground mb-1">
                  Command: <span className="text-foreground">{approval.action}</span>
                </div>
                <div className="text-muted-foreground whitespace-pre-wrap">
                  {approval.technicalDetails}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Switch
              id={`remember-${approval.id}`}
              checked={remember}
              onCheckedChange={setRemember}
              disabled={isProcessing}
            />
            <Label
              htmlFor={`remember-${approval.id}`}
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Remember this decision
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeny(approval.id)}
              disabled={isProcessing}
              className="gap-1"
            >
              <X className="w-4 h-4" />
              Deny
            </Button>
            <Button
              size="sm"
              onClick={() => onApprove(approval.id, remember)}
              disabled={isProcessing}
              className="gap-1"
            >
              <Check className="w-4 h-4" />
              Approve
            </Button>
          </div>
        </div>

        {/* High risk warning */}
        {(approval.riskLevel === 'high' || approval.riskLevel === 'critical') && (
          <div className="mt-3 p-3 rounded-lg bg-danger/10 border border-danger/20 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <div className="text-xs text-danger">
              <strong>Caution:</strong> This is a{' '}
              {approval.riskLevel === 'critical' ? 'critical' : 'high'} risk
              operation. Please review carefully before approving.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
