'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  RefreshCw,
  Clock,
  MapPin,
  Monitor,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatRelativeTime } from '@/lib/utils'

type EventType = 'all' | 'auth' | 'sandbox' | 'injection' | 'network'
type EventSeverity = 'success' | 'warning' | 'danger' | 'info'

interface SecurityEvent {
  id: string
  type: EventType
  severity: EventSeverity
  title: string
  description: string
  details: Record<string, string>
  timestamp: Date
}

const MOCK_EVENTS: SecurityEvent[] = [
  {
    id: '1',
    type: 'auth',
    severity: 'success',
    title: 'Successful login',
    description: 'User authenticated with MFA',
    details: {
      ip: '192.168.1.50',
      device: 'MacBook Pro',
      location: 'New York, US',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '2',
    type: 'injection',
    severity: 'warning',
    title: 'Prompt injection blocked',
    description: 'Detected instruction override attempt in user input',
    details: {
      pattern: 'IGNORE_PREVIOUS_INSTRUCTIONS',
      source: 'web_content',
      action: 'sanitized',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: '3',
    type: 'sandbox',
    severity: 'success',
    title: 'Sandbox execution completed',
    description: 'Command executed in isolated container',
    details: {
      command: 'git status',
      exitCode: '0',
      duration: '1.2s',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: '4',
    type: 'auth',
    severity: 'danger',
    title: 'Failed login attempt',
    description: 'Invalid MFA code provided',
    details: {
      ip: '203.0.113.42',
      attempts: '3',
      action: 'IP temporarily blocked',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: '5',
    type: 'network',
    severity: 'warning',
    title: 'Suspicious outbound request blocked',
    description: 'Request to known OAST domain blocked',
    details: {
      host: 'webhook.site',
      reason: 'Known exfiltration endpoint',
      action: 'blocked',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: '6',
    type: 'sandbox',
    severity: 'danger',
    title: 'Dangerous command blocked',
    description: 'Attempted execution of blocked command',
    details: {
      command: 'rm -rf /',
      reason: 'Command in blocklist',
      action: 'rejected',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: '7',
    type: 'auth',
    severity: 'info',
    title: 'New device paired',
    description: 'iPhone 15 Pro added to trusted devices',
    details: {
      device: 'iPhone 15 Pro',
      os: 'iOS 18.2',
      location: 'New York, US',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
]

const severityIcons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Shield,
}

const severityColors = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-primary',
}

export default function SecurityPage() {
  const [filter, setFilter] = useState<EventType>('all')
  const [events] = useState<SecurityEvent[]>(MOCK_EVENTS)

  const filteredEvents =
    filter === 'all' ? events : events.filter((e) => e.type === filter)

  const stats = {
    total: events.length,
    blocked: events.filter((e) => e.severity === 'danger').length,
    warnings: events.filter((e) => e.severity === 'warning').length,
    success: events.filter((e) => e.severity === 'success').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Events</h1>
          <p className="text-muted-foreground">
            Monitor authentication, sandbox, and network security events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Shield className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked</p>
                <p className="text-2xl font-bold text-danger">{stats.blocked}</p>
              </div>
              <XCircle className="h-8 w-8 text-danger opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-warning">
                  {stats.warnings}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-success">
                  {stats.success}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Event Log</CardTitle>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as EventType)}
          >
            <SelectTrigger className="w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="auth">Authentication</SelectItem>
              <SelectItem value="sandbox">Sandbox</SelectItem>
              <SelectItem value="injection">Injection</SelectItem>
              <SelectItem value="network">Network</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEvents.map((event, index) => {
              const Icon = severityIcons[event.severity]
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg bg-background ${severityColors[event.severity]}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{event.title}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {event.type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {event.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(event.details).map(([key, value]) => (
                          <div
                            key={key}
                            className="text-xs bg-muted px-2 py-1 rounded"
                          >
                            <span className="text-muted-foreground">{key}:</span>{' '}
                            <span className="font-mono">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
