'use client'

import { motion } from 'framer-motion'
import {
  X,
  Clock,
  Bell,
  CheckSquare,
  Lightbulb,
  Star,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Suggestion, SuggestionAction } from '@/lib/api/suggestions'

const typeIcons = {
  reminder: Bell,
  task: CheckSquare,
  insight: Lightbulb,
  recommendation: Star,
  warning: AlertTriangle,
  opportunity: Sparkles,
}

const priorityColors = {
  low: 'border-muted',
  medium: 'border-blue-500/50',
  high: 'border-amber-500/50',
  urgent: 'border-red-500/50 animate-pulse',
}

const priorityBadgeColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-500',
  high: 'bg-amber-500/10 text-amber-500',
  urgent: 'bg-red-500/10 text-red-500',
}

interface SuggestionCardProps {
  suggestion: Suggestion
  onDismiss?: (id: string) => void
  onSnooze?: (id: string, until: string) => void
  onAct?: (id: string, actionId: string) => void
  compact?: boolean
}

export function SuggestionCard({
  suggestion,
  onDismiss,
  onSnooze,
  onAct,
  compact = false,
}: SuggestionCardProps) {
  const Icon = typeIcons[suggestion.type] || Lightbulb

  const handleAction = (action: SuggestionAction) => {
    if (action.href) {
      window.open(action.href, '_blank')
    } else if (onAct) {
      onAct(suggestion.id, action.id)
    }
  }

  const handleSnooze = (duration: 'hour' | 'tomorrow' | 'week') => {
    const now = new Date()
    let until: Date

    switch (duration) {
      case 'hour':
        until = new Date(now.getTime() + 60 * 60 * 1000)
        break
      case 'tomorrow':
        until = new Date(now)
        until.setDate(until.getDate() + 1)
        until.setHours(9, 0, 0, 0)
        break
      case 'week':
        until = new Date(now)
        until.setDate(until.getDate() + 7)
        until.setHours(9, 0, 0, 0)
        break
    }

    onSnooze?.(suggestion.id, until.toISOString())
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        layout
      >
        <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors">
          <div className="p-1.5 rounded bg-muted shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{suggestion.title}</p>
          </div>
          {suggestion.actions[0] && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleAction(suggestion.actions[0])}
            >
              {suggestion.actions[0].label}
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-50 hover:opacity-100"
              onClick={() => onDismiss(suggestion.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
    >
      <Card className={`border-l-4 ${priorityColors[suggestion.priority]}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="p-2 rounded-lg bg-muted shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="secondary"
                  className={`text-xs ${priorityBadgeColors[suggestion.priority]}`}
                >
                  {suggestion.priority}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {suggestion.type}
                </Badge>
              </div>

              <h4 className="text-sm font-medium mb-1">{suggestion.title}</h4>
              <p className="text-sm text-muted-foreground">
                {suggestion.description}
              </p>

              {/* Actions */}
              {suggestion.actions.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {suggestion.actions.map((action) => (
                    <Button
                      key={action.id}
                      variant={action.type === 'primary' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleAction(action)}
                    >
                      {action.label}
                      {action.href && <ExternalLink className="ml-1 h-3 w-3" />}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Dismiss & Snooze */}
            <div className="flex flex-col gap-1">
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onDismiss(suggestion.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              {onSnooze && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleSnooze('hour')}
                  title="Snooze for 1 hour"
                >
                  <Clock className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
