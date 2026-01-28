'use client'

import { motion } from 'framer-motion'
import {
  Shield,
  Key,
  Container,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'

// Mock data - in production this would come from API
const stats = {
  credentials: { total: 12, encrypted: 12, needsRotation: 3 },
  sessions: { active: 2, total: 156, blocked: 12 },
  sandbox: { running: 1, completed: 89, failed: 3 },
  security: { score: 94, issues: 2 },
}

const recentEvents = [
  {
    id: 1,
    type: 'success',
    title: 'Sandbox execution completed',
    description: 'git status in atlas-workspace',
    time: new Date(Date.now() - 1000 * 60 * 2),
  },
  {
    id: 2,
    type: 'warning',
    title: 'Credential rotation reminder',
    description: 'OpenAI API key is 92 days old',
    time: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: 3,
    type: 'success',
    title: 'New device paired',
    description: 'MacBook Pro added successfully',
    time: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: 4,
    type: 'danger',
    title: 'Blocked login attempt',
    description: 'Invalid MFA code from 192.168.1.100',
    time: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: 5,
    type: 'success',
    title: 'Input sanitization triggered',
    description: 'Blocked potential prompt injection',
    time: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
]

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
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Security Score: {stats.security.score}%
          </Badge>
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
            value={stats.credentials.total}
            description={`${stats.credentials.encrypted} encrypted`}
            icon={Key}
            status={stats.credentials.needsRotation > 0 ? 'warning' : 'success'}
            trend={
              stats.credentials.needsRotation > 0
                ? {
                    value: stats.credentials.needsRotation,
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
            value={stats.sessions.active}
            description={`${stats.sessions.blocked} blocked today`}
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
            value={stats.sandbox.completed}
            description={`${stats.sandbox.running} running now`}
            icon={Container}
            status={stats.sandbox.failed > 0 ? 'warning' : 'success'}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatsCard
            title="Security Issues"
            value={stats.security.issues}
            description="Require attention"
            icon={AlertTriangle}
            status={stats.security.issues > 0 ? 'warning' : 'success'}
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
                          : 'status-dot-danger'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {event.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(event.time)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
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
              {[
                {
                  label: 'Credential encryption',
                  status: 'success',
                  detail: 'AES-256-GCM',
                },
                { label: 'MFA enabled', status: 'success', detail: 'TOTP' },
                {
                  label: 'Docker sandbox',
                  status: 'success',
                  detail: 'Active',
                },
                {
                  label: 'Zero-trust network',
                  status: 'success',
                  detail: 'Enabled',
                },
                {
                  label: 'Input sanitization',
                  status: 'success',
                  detail: '40+ patterns',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {item.detail}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
