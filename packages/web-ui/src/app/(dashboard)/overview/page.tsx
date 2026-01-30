'use client'

import { motion } from 'framer-motion'
import {
  Shield,
  Key,
  Container,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import { useDashboardStats, useSecurityEvents, useSecurityPosture } from '@/hooks/use-dashboard'

const quickActions = [
  {
    title: 'Add credential',
    href: '/security/credentials',
    icon: Key,
  },
  {
    title: 'View allowlist',
    href: '/security/allowlist',
    icon: Shield,
  },
  {
    title: 'Sandbox logs',
    href: '/sandbox',
    icon: Container,
  },
]

export default function DashboardPage() {
  const { stats, isLoading: isLoadingStats } = useDashboardStats()
  const { events: recentEvents, isLoading: isLoadingEvents } = useSecurityEvents(5)
  const { posture, isLoading: isLoadingPosture } = useSecurityPosture()

  const isLoading = isLoadingStats || isLoadingEvents || isLoadingPosture

  // Default stats while loading
  const dashboardStats = stats || {
    credentials: { total: 0, encrypted: 0, needsRotation: 0 },
    sessions: { active: 0, total: 0, blocked: 0 },
    sandbox: { running: 0, completed: 0, failed: 0 },
    security: { score: 0, issues: 0 },
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your Atlas security posture
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingStats ? (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </Badge>
          ) : (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Security Score: {dashboardStats.security.score}%
            </Badge>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <StatsCard
            title="Credentials"
            value={dashboardStats.credentials.total}
            description={`${dashboardStats.credentials.encrypted} encrypted`}
            icon={Key}
            status={dashboardStats.credentials.needsRotation > 0 ? 'warning' : 'success'}
            trend={
              dashboardStats.credentials.needsRotation > 0
                ? {
                    value: dashboardStats.credentials.needsRotation,
                    label: 'need rotation',
                    isPositive: false,
                  }
                : undefined
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatsCard
            title="Active Sessions"
            value={dashboardStats.sessions.active}
            description={`${dashboardStats.sessions.blocked} blocked today`}
            icon={Activity}
            status="success"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatsCard
            title="Sandbox Executions"
            value={dashboardStats.sandbox.completed}
            description={`${dashboardStats.sandbox.running} running now`}
            icon={Container}
            status={dashboardStats.sandbox.failed > 0 ? 'warning' : 'success'}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatsCard
            title="Security Issues"
            value={dashboardStats.security.issues}
            description="Require attention"
            icon={AlertTriangle}
            status={dashboardStats.security.issues > 0 ? 'warning' : 'success'}
          />
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent security events */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Security Events</CardTitle>
            <Link href="/security">
              <Button variant="ghost" size="sm" className="gap-1">
                View all
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoadingEvents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No recent events</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3"
                  >
                    <div
                      className={`mt-1 status-dot ${
                        event.type === 'success'
                          ? 'status-dot-success'
                          : event.type === 'warning'
                            ? 'status-dot-warning'
                            : event.type === 'danger'
                              ? 'status-dot-danger'
                              : 'status-dot-info'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {event.title}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(new Date(event.timestamp))}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions & status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                  >
                    <action.icon className="h-4 w-4" />
                    {action.title}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingPosture ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${posture?.credentialEncryption !== 'none' ? 'text-success' : 'text-danger'}`} />
                      <span className="text-sm">Credential encryption</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {posture?.credentialEncryption || 'AES-256-GCM'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${posture?.mfaEnabled ? 'text-success' : 'text-danger'}`} />
                      <span className="text-sm">MFA enabled</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {posture?.mfaEnabled ? 'TOTP' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${posture?.dockerAvailable ? 'text-success' : 'text-warning'}`} />
                      <span className="text-sm">Docker sandbox</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {posture?.sandboxActive ? 'Active' : posture?.dockerAvailable ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${posture?.networkSecure ? 'text-success' : 'text-warning'}`} />
                      <span className="text-sm">Zero-trust network</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {posture?.networkSecure ? 'Enabled' : 'Check config'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${posture?.inputSanitization ? 'text-success' : 'text-danger'}`} />
                      <span className="text-sm">Input sanitization</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {posture?.patternCount || 40}+ patterns
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
