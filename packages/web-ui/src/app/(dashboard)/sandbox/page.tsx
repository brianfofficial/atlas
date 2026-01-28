'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Container,
  Play,
  Square,
  Clock,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Terminal,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRelativeTime } from '@/lib/utils'

interface SandboxExecution {
  id: string
  command: string
  status: 'running' | 'completed' | 'failed' | 'blocked'
  startedAt: Date
  completedAt?: Date
  exitCode?: number
  duration?: number
  memoryUsed?: number
  cpuUsed?: number
  output?: string
  error?: string
}

const MOCK_EXECUTIONS: SandboxExecution[] = [
  {
    id: '1',
    command: 'git status',
    status: 'running',
    startedAt: new Date(Date.now() - 1000 * 5),
    memoryUsed: 45,
    cpuUsed: 12,
  },
  {
    id: '2',
    command: 'ls -la ~/atlas-workspace',
    status: 'completed',
    startedAt: new Date(Date.now() - 1000 * 60 * 2),
    completedAt: new Date(Date.now() - 1000 * 60 * 2 + 1200),
    exitCode: 0,
    duration: 1.2,
    memoryUsed: 32,
    cpuUsed: 5,
    output: 'total 24\ndrwxr-xr-x  6 user  staff   192 Jan 28 10:00 .\n...',
  },
  {
    id: '3',
    command: 'grep -r "TODO" src/',
    status: 'completed',
    startedAt: new Date(Date.now() - 1000 * 60 * 15),
    completedAt: new Date(Date.now() - 1000 * 60 * 15 + 3400),
    exitCode: 0,
    duration: 3.4,
    memoryUsed: 128,
    cpuUsed: 45,
  },
  {
    id: '4',
    command: 'rm -rf /',
    status: 'blocked',
    startedAt: new Date(Date.now() - 1000 * 60 * 30),
    error: 'Command blocked: rm is in the blocklist',
  },
  {
    id: '5',
    command: 'cat /etc/passwd',
    status: 'failed',
    startedAt: new Date(Date.now() - 1000 * 60 * 45),
    completedAt: new Date(Date.now() - 1000 * 60 * 45 + 100),
    exitCode: 1,
    duration: 0.1,
    error: 'Permission denied: path outside allowed directories',
  },
]

const statusConfig = {
  running: { icon: Activity, color: 'text-primary', bg: 'bg-primary/10', badge: 'default' as const },
  completed: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', badge: 'success' as const },
  failed: { icon: XCircle, color: 'text-danger', bg: 'bg-danger/10', badge: 'danger' as const },
  blocked: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', badge: 'warning' as const },
}

export default function SandboxPage() {
  const [executions] = useState<SandboxExecution[]>(MOCK_EXECUTIONS)
  const [selectedExecution, setSelectedExecution] = useState<SandboxExecution | null>(null)

  const stats = {
    running: executions.filter((e) => e.status === 'running').length,
    completed: executions.filter((e) => e.status === 'completed').length,
    failed: executions.filter((e) => e.status === 'failed').length,
    blocked: executions.filter((e) => e.status === 'blocked').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sandbox Executions</h1>
          <p className="text-muted-foreground">
            Monitor Docker container executions and resource usage
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Sandbox configuration summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6">
            <div className="p-3 rounded-lg bg-primary/10">
              <Container className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 grid grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Image</p>
                <p className="text-sm font-medium">alpine:3.19</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Memory Limit</p>
                <p className="text-sm font-medium">512 MB</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CPU Limit</p>
                <p className="text-sm font-medium">0.5 cores</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timeout</p>
                <p className="text-sm font-medium">30 seconds</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Read-only FS
              </Badge>
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Caps dropped
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-2xl font-bold">{stats.running}</p>
              </div>
              <Activity className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-success">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-danger">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-danger opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked</p>
                <p className="text-2xl font-bold text-warning">{stats.blocked}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executions list */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {executions.map((execution, index) => {
                const config = statusConfig[execution.status]
                const Icon = config.icon

                return (
                  <motion.div
                    key={execution.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedExecution?.id === execution.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedExecution(execution)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-sm font-medium truncate">
                            {execution.command}
                          </code>
                          <Badge variant={config.badge} className="text-xs shrink-0">
                            {execution.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(execution.startedAt)}
                          </span>
                          {execution.duration && (
                            <span>{execution.duration}s</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Execution details */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Execution Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedExecution ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Command</p>
                  <code className="block p-3 rounded-lg bg-muted text-sm">
                    {selectedExecution.command}
                  </code>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge variant={statusConfig[selectedExecution.status].badge}>
                      {selectedExecution.status}
                    </Badge>
                  </div>
                  {selectedExecution.exitCode !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Exit Code</p>
                      <p className="font-mono">{selectedExecution.exitCode}</p>
                    </div>
                  )}
                  {selectedExecution.duration && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Duration</p>
                      <p>{selectedExecution.duration}s</p>
                    </div>
                  )}
                </div>

                {selectedExecution.status === 'running' && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Memory</span>
                        <span>{selectedExecution.memoryUsed}MB / 512MB</span>
                      </div>
                      <Progress
                        value={(selectedExecution.memoryUsed || 0) / 512 * 100}
                        variant="default"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">CPU</span>
                        <span>{selectedExecution.cpuUsed}%</span>
                      </div>
                      <Progress
                        value={selectedExecution.cpuUsed || 0}
                        variant="default"
                      />
                    </div>
                  </div>
                )}

                {selectedExecution.output && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Output</p>
                    <pre className="p-3 rounded-lg bg-background-tertiary text-xs font-mono overflow-auto max-h-40">
                      {selectedExecution.output}
                    </pre>
                  </div>
                )}

                {selectedExecution.error && (
                  <div>
                    <p className="text-xs text-danger mb-1">Error</p>
                    <pre className="p-3 rounded-lg bg-danger/10 text-xs font-mono text-danger overflow-auto">
                      {selectedExecution.error}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Terminal className="h-12 w-12 mb-4 opacity-50" />
                <p>Select an execution to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
