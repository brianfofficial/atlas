'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Cpu,
  Clock,
  BarChart3,
  Settings,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'
import { DemoBanner } from '@/components/ui/demo-banner'

// Demo data - will be replaced with real API data
const dailyUsage = [
  { date: 'Jan 22', cost: 2.45, tokens: 45000 },
  { date: 'Jan 23', cost: 3.12, tokens: 58000 },
  { date: 'Jan 24', cost: 1.89, tokens: 34000 },
  { date: 'Jan 25', cost: 4.56, tokens: 82000 },
  { date: 'Jan 26', cost: 2.78, tokens: 51000 },
  { date: 'Jan 27', cost: 3.45, tokens: 63000 },
  { date: 'Jan 28', cost: 1.23, tokens: 22000 },
]

const modelBreakdown = [
  { name: 'Claude Sonnet', value: 65, cost: 12.45, color: '#6366f1' },
  { name: 'Claude Haiku', value: 25, cost: 1.23, color: '#10b981' },
  { name: 'GPT-4o', value: 8, cost: 3.45, color: '#f59e0b' },
  { name: 'Local (Ollama)', value: 2, cost: 0, color: '#71717a' },
]

const stats = {
  today: 1.23,
  todayTokens: 22000,
  mtd: 19.48,
  projected: 28.50,
  budget: 50,
  budgetUsed: 39,
}

export default function CostsPage() {
  const [budgetEnabled, setBudgetEnabled] = useState(true)
  const [budgetLimit, setBudgetLimit] = useState(50)

  const isOverBudget = stats.projected > stats.budget

  return (
    <div className="space-y-6">
      {/* Demo mode banner */}
      <DemoBanner
        feature="Usage & Costs"
        description="This page shows sample data. Real usage tracking will be available once you start using Atlas AI features."
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usage & Costs</h1>
          <p className="text-muted-foreground">
            Monitor API usage and manage budget alerts
          </p>
        </div>
      </div>

      {/* Budget warning */}
      {isOverBudget && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Projected monthly spend ({formatCurrency(stats.projected)}) exceeds
            your budget ({formatCurrency(stats.budget)}). Consider using local
            models for simple tasks.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.today)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.todayTokens.toLocaleString()} tokens
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Month to Date</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.mtd)}
                  </p>
                  <p className="text-xs text-success flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    12% less than last month
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Projected</p>
                  <p
                    className={`text-2xl font-bold ${
                      isOverBudget ? 'text-warning' : ''
                    }`}
                  >
                    {formatCurrency(stats.projected)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Based on current usage
                  </p>
                </div>
                <TrendingUp
                  className={`h-8 w-8 opacity-50 ${
                    isOverBudget ? 'text-warning' : 'text-primary'
                  }`}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Budget Used</p>
                  <span className="text-sm font-medium">
                    {stats.budgetUsed}%
                  </span>
                </div>
                <Progress
                  value={stats.budgetUsed}
                  variant={stats.budgetUsed > 80 ? 'warning' : 'default'}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {formatCurrency(stats.mtd)} of {formatCurrency(stats.budget)}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Usage chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Usage</CardTitle>
            <CardDescription>Cost and token usage over the past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsage}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'cost'
                        ? formatCurrency(value)
                        : value.toLocaleString(),
                      name === 'cost' ? 'Cost' : 'Tokens',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Model breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>By Model</CardTitle>
            <CardDescription>Usage distribution across models</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {modelBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Usage']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {modelBreakdown.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: model.color }}
                    />
                    <span className="text-sm">{model.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(model.cost)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Budget Settings
          </CardTitle>
          <CardDescription>
            Set spending limits and alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Budget Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when approaching budget limit
              </p>
            </div>
            <Switch checked={budgetEnabled} onCheckedChange={setBudgetEnabled} />
          </div>

          {budgetEnabled && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Monthly Budget</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">per month</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Alert Thresholds</Label>
                <div className="space-y-2">
                  {[50, 75, 90].map((threshold) => (
                    <div
                      key={threshold}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <span className="text-sm">Alert at {threshold}%</span>
                      <Badge
                        variant={threshold >= 90 ? 'danger' : threshold >= 75 ? 'warning' : 'secondary'}
                      >
                        {formatCurrency((budgetLimit * threshold) / 100)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-3">Cost Saving Tips</h4>
            <div className="space-y-2">
              {[
                'Use Claude Haiku for simple tasks (10x cheaper)',
                'Enable local models for non-critical operations',
                'Use prompt caching for repeated system instructions',
                'Set up tiered routing: simple tasks → local, complex → cloud',
              ].map((tip, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span className="text-success">•</span>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
