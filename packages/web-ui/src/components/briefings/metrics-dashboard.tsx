'use client'

import { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  Users,
  Shield,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  MetricsDashboard as MetricsDashboardData,
  MetricValue,
  KillCriteriaCheck,
  TrustSignal,
  TrendPoint,
} from '@/lib/api/briefings'

interface MetricsDashboardProps {
  data?: MetricsDashboardData
  isLoading?: boolean
  onRefresh?: () => void
  className?: string
}

export function MetricsDashboard({
  data,
  isLoading,
  onRefresh,
  className,
}: MetricsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '14d' | '30d'>('7d')

  if (isLoading) {
    return <MetricsDashboardSkeleton />
  }

  if (!data) {
    return (
      <div className={cn('text-center py-12', className)}>
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground">No metrics data available</p>
        <Button variant="outline" className="mt-4" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Load Metrics
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Briefing Metrics</h2>
          <p className="text-sm text-muted-foreground">
            Product validation dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as typeof selectedPeriod)}>
            <TabsList className="h-8">
              <TabsTrigger value="7d" className="text-xs px-2">7 Days</TabsTrigger>
              <TabsTrigger value="14d" className="text-xs px-2">14 Days</TabsTrigger>
              <TabsTrigger value="30d" className="text-xs px-2">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Trust Health */}
      <TrustHealthCard health={data.trustHealth} />

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="DAAR"
          description="Daily Active Approval Rate"
          metric={data.metrics.daar}
          icon={Target}
        />
        <MetricCard
          title="TTFA"
          description="Time to First Action"
          metric={data.metrics.ttfa}
          icon={Clock}
          suffix="s"
        />
        <MetricCard
          title="DAR"
          description="Draft Acceptance Rate"
          metric={data.metrics.dar}
          icon={CheckCircle}
          suffix="%"
        />
        <MetricCard
          title="Edit Rate"
          description="Drafts edited before approval"
          metric={data.metrics.editRate}
          icon={Activity}
          suffix="%"
        />
      </div>

      {/* Retention Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retention</CardTitle>
          <CardDescription>User return rates by day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <RetentionBar
              label="Day 7"
              value={data.metrics.retention.day7.value}
              target={data.metrics.retention.day7.target}
            />
            <RetentionBar
              label="Day 14"
              value={data.metrics.retention.day14.value}
              target={data.metrics.retention.day14.target}
            />
            <RetentionBar
              label="Day 30"
              value={data.metrics.retention.day30.value}
              target={data.metrics.retention.day30.target}
            />
          </div>
        </CardContent>
      </Card>

      {/* Trends Chart */}
      {data.trends && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trends</CardTitle>
            <CardDescription>Metric history over time</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendsChart
              daar={data.trends.daar}
              dar={data.trends.dar}
              editRate={data.trends.editRate}
            />
          </CardContent>
        </Card>
      )}

      {/* Kill Criteria */}
      <KillCriteriaCard criteria={data.killCriteria} />

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          title="Second Surface"
          description="Users engaging with 2+ surfaces"
          metric={data.metrics.secondSurfaceAdoption}
          icon={Users}
          suffix="%"
        />
        <MetricCard
          title="Unprompted Return"
          description="Users returning without notification"
          metric={data.metrics.unpromptedReturn}
          icon={Shield}
          suffix="%"
        />
      </div>
    </div>
  )
}

// Individual metric card
interface MetricCardProps {
  title: string
  description: string
  metric: MetricValue
  icon: typeof Activity
  suffix?: string
}

function MetricCard({ title, description, metric, icon: Icon, suffix = '' }: MetricCardProps) {
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus
  const trendColor = metric.trend === 'up' ? 'text-green-500' : metric.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'

  const isOnTarget = metric.target ? metric.value >= metric.target : true

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value}
                {suffix}
              </span>
              {metric.target && (
                <span className={cn('text-xs', isOnTarget ? 'text-green-500' : 'text-red-500')}>
                  / {metric.target}{suffix}
                </span>
              )}
            </div>
          </div>
          <div className={cn('p-2 rounded-lg', isOnTarget ? 'bg-green-500/10' : 'bg-muted')}>
            <Icon className={cn('h-4 w-4', isOnTarget ? 'text-green-500' : 'text-muted-foreground')} />
          </div>
        </div>
        {metric.trend && (
          <div className={cn('flex items-center gap-1 mt-2 text-xs', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{metric.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Trust health card
interface TrustHealthCardProps {
  health: MetricsDashboardData['trustHealth']
}

function TrustHealthCard({ health }: TrustHealthCardProps) {
  const scoreColor =
    health.score >= 80 ? 'text-green-500' :
    health.score >= 60 ? 'text-yellow-500' : 'text-red-500'

  const trendIcon =
    health.trend === 'improving' ? TrendingUp :
    health.trend === 'declining' ? TrendingDown : Minus

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Trust Health Score</p>
            <div className="flex items-baseline gap-3">
              <span className={cn('text-4xl font-bold', scoreColor)}>
                {health.score}
              </span>
              <Badge
                variant={health.trend === 'improving' ? 'default' : health.trend === 'declining' ? 'destructive' : 'secondary'}
              >
                {React.createElement(trendIcon, { className: 'h-3 w-3 inline mr-1' })}
                {health.trend}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-2">Active Signals</p>
            <div className="flex gap-1 justify-end">
              {health.signals.map((signal, i) => (
                <SignalIndicator key={i} signal={signal} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SignalIndicator({ signal }: { signal: TrustSignal }) {
  const color =
    signal.level === 'normal' ? 'bg-green-500' :
    signal.level === 'warning' ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div
      className={cn('h-2 w-2 rounded-full', color)}
      title={`${signal.type}: ${signal.description}`}
    />
  )
}

// Retention bar
interface RetentionBarProps {
  label: string
  value: number
  target?: number
}

function RetentionBar({ label, value, target }: RetentionBarProps) {
  const isOnTarget = target ? value >= target : true

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', isOnTarget ? 'text-green-500' : 'text-muted-foreground')}>
          {value.toFixed(0)}%
        </span>
      </div>
      <Progress
        value={value}
        className={cn('h-2', isOnTarget ? '[&>div]:bg-green-500' : '')}
      />
      {target && (
        <p className="text-xs text-muted-foreground">
          Target: {target}%
        </p>
      )}
    </div>
  )
}

// Trends chart
interface TrendsChartProps {
  daar: TrendPoint[]
  dar: TrendPoint[]
  editRate: TrendPoint[]
}

function TrendsChart({ daar, dar, editRate }: TrendsChartProps) {
  // Combine data for chart
  const chartData = daar.map((point, i) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    daar: point.value,
    dar: dar[i]?.value || 0,
    editRate: editRate[i]?.value || 0,
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Area
            type="monotone"
            dataKey="daar"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary) / 0.1)"
            name="DAAR"
          />
          <Area
            type="monotone"
            dataKey="dar"
            stroke="#22c55e"
            fill="#22c55e20"
            name="DAR"
          />
          <Area
            type="monotone"
            dataKey="editRate"
            stroke="#eab308"
            fill="#eab30820"
            name="Edit Rate"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Kill criteria card
interface KillCriteriaCardProps {
  criteria: MetricsDashboardData['killCriteria']
}

function KillCriteriaCard({ criteria }: KillCriteriaCardProps) {
  const StatusIcon =
    criteria.status === 'passing' ? CheckCircle :
    criteria.status === 'warning' ? AlertTriangle : XCircle

  const statusColor =
    criteria.status === 'passing' ? 'text-green-500' :
    criteria.status === 'warning' ? 'text-yellow-500' : 'text-red-500'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Kill Criteria</CardTitle>
            <CardDescription>Product validation thresholds</CardDescription>
          </div>
          <Badge
            variant={
              criteria.status === 'passing' ? 'default' :
              criteria.status === 'warning' ? 'outline' : 'destructive'
            }
          >
            <StatusIcon className={cn('h-3 w-3 mr-1', statusColor)} />
            {criteria.status.charAt(0).toUpperCase() + criteria.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {criteria.checks.map((check, i) => (
            <KillCriteriaRow key={i} check={check} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function KillCriteriaRow({ check }: { check: KillCriteriaCheck }) {
  const StatusIcon =
    check.status === 'passing' ? CheckCircle :
    check.status === 'warning' ? AlertTriangle : XCircle

  const statusColor =
    check.status === 'passing' ? 'text-green-500' :
    check.status === 'warning' ? 'text-yellow-500' : 'text-red-500'

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon className={cn('h-4 w-4', statusColor)} />
        <div>
          <p className="text-sm font-medium">{check.name}</p>
          <p className="text-xs text-muted-foreground">{check.description}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn('text-sm font-medium', statusColor)}>
          {check.value.toFixed(1)}
        </p>
        <p className="text-xs text-muted-foreground">
          / {check.threshold}
        </p>
      </div>
    </div>
  )
}

// Loading skeleton
function MetricsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>

      <Skeleton className="h-24 rounded-lg" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}

// Need to import React for createElement
import React from 'react'
