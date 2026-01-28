import * as React from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from './card'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  status?: 'success' | 'warning' | 'danger' | 'default'
  className?: string
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = 'default',
  className,
}: StatsCardProps) {
  const statusColors = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    default: 'text-muted-foreground',
  }

  const statusGlow = {
    success: 'glow-success',
    warning: 'glow-warning',
    danger: 'glow-danger',
    default: '',
  }

  return (
    <Card className={cn('relative overflow-hidden', statusGlow[status], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className={cn('text-sm font-medium', statusColors[status])}>
          {title}
        </span>
        {Icon && (
          <Icon
            className={cn('h-4 w-4', statusColors[status])}
            aria-hidden="true"
          />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className={cn('text-xs', statusColors[status])}>{description}</p>
        )}
        {trend && (
          <div className="mt-2 flex items-center text-xs">
            <span
              className={cn(
                'font-medium',
                trend.isPositive ? 'text-success' : 'text-danger'
              )}
            >
              {trend.isPositive ? '+' : ''}
              {trend.value}%
            </span>
            <span className="ml-1 text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
