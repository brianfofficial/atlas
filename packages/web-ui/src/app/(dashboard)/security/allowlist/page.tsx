'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
  FolderOpen,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Command {
  name: string
  description: string
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  isAllowed: boolean
  requiresApproval: boolean
}

interface Directory {
  path: string
  permissions: ('read' | 'write' | 'execute')[]
  recursive: boolean
}

const SAFE_COMMANDS: Command[] = [
  { name: 'ls', description: 'List directory contents', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'cat', description: 'Display file contents', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'head', description: 'Display first lines of file', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'tail', description: 'Display last lines of file', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'grep', description: 'Search file contents', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'find', description: 'Find files by name', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'wc', description: 'Word, line, character count', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'pwd', description: 'Print working directory', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'echo', description: 'Display text', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
  { name: 'date', description: 'Display current date/time', riskLevel: 'safe', isAllowed: true, requiresApproval: false },
]

const DANGEROUS_COMMANDS: Command[] = [
  { name: 'rm', description: 'Remove files/directories', riskLevel: 'dangerous', isAllowed: false, requiresApproval: true },
  { name: 'mv', description: 'Move/rename files', riskLevel: 'moderate', isAllowed: false, requiresApproval: true },
  { name: 'cp', description: 'Copy files', riskLevel: 'moderate', isAllowed: false, requiresApproval: true },
  { name: 'chmod', description: 'Change file permissions', riskLevel: 'dangerous', isAllowed: false, requiresApproval: true },
  { name: 'curl', description: 'Transfer data from URLs', riskLevel: 'dangerous', isAllowed: false, requiresApproval: true },
  { name: 'wget', description: 'Download files from web', riskLevel: 'dangerous', isAllowed: false, requiresApproval: true },
  { name: 'ssh', description: 'Secure shell connection', riskLevel: 'dangerous', isAllowed: false, requiresApproval: true },
  { name: 'pip', description: 'Python package installer', riskLevel: 'moderate', isAllowed: false, requiresApproval: true },
  { name: 'npm', description: 'Node package manager', riskLevel: 'moderate', isAllowed: false, requiresApproval: true },
]

const BLOCKED_COMMANDS = [
  'sudo', 'su', 'passwd', 'mount', 'umount', 'dd', 'kill', 'shutdown',
  'reboot', 'systemctl', 'crontab', 'nc', 'eval', 'exec',
]

const DEFAULT_DIRECTORIES: Directory[] = [
  { path: '~/atlas-workspace', permissions: ['read', 'write', 'execute'], recursive: true },
  { path: '/tmp', permissions: ['read', 'write'], recursive: false },
]

const riskColors = {
  safe: 'bg-success/10 text-success border-success/20',
  moderate: 'bg-warning/10 text-warning border-warning/20',
  dangerous: 'bg-danger/10 text-danger border-danger/20',
}

export default function AllowlistPage() {
  const [safeCommands, setSafeCommands] = useState(SAFE_COMMANDS)
  const [dangerousCommands, setDangerousCommands] = useState(DANGEROUS_COMMANDS)
  const [directories, setDirectories] = useState(DEFAULT_DIRECTORIES)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddCommand, setShowAddCommand] = useState(false)
  const [showAddDirectory, setShowAddDirectory] = useState(false)

  const toggleCommand = (name: string, isSafe: boolean) => {
    if (isSafe) {
      setSafeCommands((prev) =>
        prev.map((cmd) =>
          cmd.name === name ? { ...cmd, isAllowed: !cmd.isAllowed } : cmd
        )
      )
    } else {
      setDangerousCommands((prev) =>
        prev.map((cmd) =>
          cmd.name === name ? { ...cmd, isAllowed: !cmd.isAllowed } : cmd
        )
      )
    }
  }

  const filteredSafe = safeCommands.filter((cmd) =>
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredDangerous = dangerousCommands.filter((cmd) =>
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Command Allowlist</h1>
          <p className="text-muted-foreground">
            Configure which commands can be executed in the sandbox
          </p>
        </div>
      </div>

      {/* Policy notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Deny-by-default policy:</strong> Only explicitly allowed
          commands can execute. Dangerous commands always require approval.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="commands">
        <TabsList>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="directories">Directories</TabsTrigger>
          <TabsTrigger value="blocked">Blocked</TabsTrigger>
        </TabsList>

        <TabsContent value="commands" className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Safe commands */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Safe Commands
                  </CardTitle>
                  <CardDescription>
                    These commands are pre-approved and can run without explicit
                    approval
                  </CardDescription>
                </div>
                <Badge variant="success">
                  {safeCommands.filter((c) => c.isAllowed).length} enabled
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredSafe.map((cmd) => (
                  <div
                    key={cmd.name}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Terminal className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <code className="text-sm font-medium">{cmd.name}</code>
                        <p className="text-xs text-muted-foreground">
                          {cmd.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={cmd.isAllowed}
                      onCheckedChange={() => toggleCommand(cmd.name, true)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dangerous commands */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Dangerous Commands
                  </CardTitle>
                  <CardDescription>
                    These commands require explicit approval before each
                    execution
                  </CardDescription>
                </div>
                <Badge variant="warning">
                  {dangerousCommands.filter((c) => c.isAllowed).length} enabled
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredDangerous.map((cmd) => (
                  <div
                    key={cmd.name}
                    className={`flex items-center justify-between p-3 rounded-lg border ${riskColors[cmd.riskLevel]}`}
                  >
                    <div className="flex items-center gap-3">
                      <Terminal className="h-4 w-4" />
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-medium">{cmd.name}</code>
                          <Badge
                            variant={
                              cmd.riskLevel === 'dangerous'
                                ? 'danger'
                                : 'warning'
                            }
                            className="text-xs"
                          >
                            {cmd.riskLevel}
                          </Badge>
                        </div>
                        <p className="text-xs opacity-80">{cmd.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">
                        Requires approval
                      </span>
                      <Switch
                        checked={cmd.isAllowed}
                        onCheckedChange={() => toggleCommand(cmd.name, false)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    Allowed Directories
                  </CardTitle>
                  <CardDescription>
                    Commands can only access files within these directories
                  </CardDescription>
                </div>
                <Dialog open={showAddDirectory} onOpenChange={setShowAddDirectory}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Directory
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Directory</DialogTitle>
                      <DialogDescription>
                        Specify a directory path and its permissions
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Path</Label>
                        <Input placeholder="/path/to/directory" />
                      </div>
                      <div className="space-y-2">
                        <Label>Permissions</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked />
                            <span className="text-sm">Read</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" />
                            <span className="text-sm">Write</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" />
                            <span className="text-sm">Execute</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="recursive" />
                        <Label htmlFor="recursive">Include subdirectories</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddDirectory(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={() => setShowAddDirectory(false)}>
                        Add Directory
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {directories.map((dir, index) => (
                  <div
                    key={dir.path}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <code className="text-sm font-medium">{dir.path}</code>
                        <div className="flex items-center gap-2 mt-1">
                          {dir.permissions.map((perm) => (
                            <Badge
                              key={perm}
                              variant="secondary"
                              className="text-xs"
                            >
                              {perm}
                            </Badge>
                          ))}
                          {dir.recursive && (
                            <Badge variant="outline" className="text-xs">
                              recursive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Blocked patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-danger" />
                Blocked Patterns
              </CardTitle>
              <CardDescription>
                These file patterns are never accessible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  '.env*',
                  '*credentials*',
                  '*secret*',
                  '*.pem',
                  '*.key',
                  'id_rsa*',
                  '.ssh/*',
                  '.aws/*',
                  '.kube/*',
                ].map((pattern) => (
                  <Badge key={pattern} variant="danger" className="font-mono">
                    {pattern}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-danger" />
                Always Blocked
              </CardTitle>
              <CardDescription>
                These commands can never be executed, even with approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="danger" className="mb-4">
                <AlertDescription>
                  These commands are blocked at the system level and cannot be
                  unblocked through the UI for security reasons.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                {BLOCKED_COMMANDS.map((cmd) => (
                  <Badge
                    key={cmd}
                    variant="danger"
                    className="font-mono text-sm"
                  >
                    {cmd}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
