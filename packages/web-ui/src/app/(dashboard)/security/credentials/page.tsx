'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Key,
  Plus,
  MoreVertical,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Trash2,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatDate } from '@/lib/utils'

type CredentialService =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'azure'
  | 'aws'
  | 'github'
  | 'slack'
  | 'discord'
  | 'telegram'

interface Credential {
  id: string
  service: CredentialService
  name: string
  lastUsed: Date | null
  createdAt: Date
  rotatedAt: Date
  isHealthy: boolean
}

const MOCK_CREDENTIALS: Credential[] = [
  {
    id: '1',
    service: 'anthropic',
    name: 'Production API Key',
    lastUsed: new Date(Date.now() - 1000 * 60 * 5),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    rotatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    isHealthy: true,
  },
  {
    id: '2',
    service: 'openai',
    name: 'GPT-4 Access',
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 92),
    rotatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 92),
    isHealthy: false, // Needs rotation
  },
  {
    id: '3',
    service: 'github',
    name: 'Personal Access Token',
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    rotatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    isHealthy: true,
  },
  {
    id: '4',
    service: 'aws',
    name: 'S3 Access Key',
    lastUsed: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 95),
    rotatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 95),
    isHealthy: false,
  },
  {
    id: '5',
    service: 'slack',
    name: 'Bot Token',
    lastUsed: new Date(Date.now() - 1000 * 60 * 30),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
    rotatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
    isHealthy: true,
  },
]

const serviceColors: Record<CredentialService, string> = {
  anthropic: 'bg-orange-500/10 text-orange-500',
  openai: 'bg-green-500/10 text-green-500',
  google: 'bg-blue-500/10 text-blue-500',
  azure: 'bg-cyan-500/10 text-cyan-500',
  aws: 'bg-yellow-500/10 text-yellow-500',
  github: 'bg-purple-500/10 text-purple-500',
  slack: 'bg-pink-500/10 text-pink-500',
  discord: 'bg-indigo-500/10 text-indigo-500',
  telegram: 'bg-sky-500/10 text-sky-500',
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>(MOCK_CREDENTIALS)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [deleteCredential, setDeleteCredential] = useState<Credential | null>(null)

  const unhealthyCount = credentials.filter((c) => !c.isHealthy).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credentials</h1>
          <p className="text-muted-foreground">
            Manage encrypted API keys and secrets
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Credential
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Credential</DialogTitle>
              <DialogDescription>
                Your credential will be encrypted with AES-256-GCM and stored
                securely.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Service</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="discord">Discord</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="e.g., Production API Key" />
              </div>
              <div className="space-y-2">
                <Label>API Key / Secret</Label>
                <Input type="password" placeholder="sk-..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowAddDialog(false)}>
                <Shield className="mr-2 h-4 w-4" />
                Encrypt & Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Warning for unhealthy credentials */}
      {unhealthyCount > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {unhealthyCount} credential{unhealthyCount > 1 ? 's' : ''} older than
            90 days. Consider rotating for security.
          </AlertDescription>
        </Alert>
      )}

      {/* Encryption status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success/10">
              <Shield className="h-6 w-6 text-success" />
            </div>
            <div>
              <h3 className="font-medium">All credentials encrypted</h3>
              <p className="text-sm text-muted-foreground">
                Using AES-256-GCM with OS keychain integration (keytar)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credentials list */}
      <div className="space-y-4">
        {credentials.map((credential, index) => (
          <motion.div
            key={credential.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              className={
                !credential.isHealthy ? 'border-warning/50' : ''
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-lg ${serviceColors[credential.service]}`}
                    >
                      <Key className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{credential.name}</h3>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {credential.service}
                        </Badge>
                        {!credential.isHealthy && (
                          <Badge variant="warning" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Needs rotation
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Created {formatDate(credential.createdAt)}
                        </span>
                        {credential.lastUsed && (
                          <span>
                            Last used {formatDate(credential.lastUsed)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Rotate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger focus:text-danger"
                        onClick={() => setDeleteCredential(credential)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteCredential}
        onOpenChange={() => setDeleteCredential(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete credential?</DialogTitle>
            <DialogDescription>
              This will permanently delete{' '}
              <strong>{deleteCredential?.name}</strong>. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteCredential(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCredentials((prev) =>
                  prev.filter((c) => c.id !== deleteCredential?.id)
                )
                setDeleteCredential(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
