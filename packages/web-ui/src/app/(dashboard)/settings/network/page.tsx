'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Network,
  Shield,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Lock,
  Server,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { DemoBanner } from '@/components/ui/demo-banner'

interface IPRule {
  id: string
  ip: string
  type: 'allow' | 'block'
  description: string
  addedAt: Date
}

const MOCK_IP_RULES: IPRule[] = [
  {
    id: '1',
    ip: '192.168.1.0/24',
    type: 'allow',
    description: 'Home network',
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  },
  {
    id: '2',
    ip: '10.0.0.0/8',
    type: 'allow',
    description: 'Office VPN',
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
  },
  {
    id: '3',
    ip: '203.0.113.42',
    type: 'block',
    description: 'Blocked - suspicious activity',
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
]

export default function NetworkSettingsPage() {
  const [ipRules, setIpRules] = useState<IPRule[]>(MOCK_IP_RULES)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [localOnly, setLocalOnly] = useState(true)
  const [requireTailscale, setRequireTailscale] = useState(false)

  const allowedCount = ipRules.filter((r) => r.type === 'allow').length
  const blockedCount = ipRules.filter((r) => r.type === 'block').length

  return (
    <div className="space-y-6">
      {/* Demo mode banner */}
      <DemoBanner
        feature="Network Settings"
        description="This page shows sample network rules. Real IP access controls can be configured here."
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Network Settings</h1>
        <p className="text-muted-foreground">
          Configure zero-trust network access controls
        </p>
      </div>

      {/* Zero-trust notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Zero-trust architecture:</strong> Atlas does not implicitly
          trust localhost connections. All access must be explicitly allowed.
        </AlertDescription>
      </Alert>

      {/* Network mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Network Mode
          </CardTitle>
          <CardDescription>
            Control how Atlas can be accessed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Lock className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium">Local Only Mode</p>
                <p className="text-sm text-muted-foreground">
                  Only accept connections from 127.0.0.1
                </p>
              </div>
            </div>
            <Switch checked={localOnly} onCheckedChange={setLocalOnly} />
          </div>

          {!localOnly && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Disabling local-only mode exposes Atlas to network access.
                  Ensure you have proper IP allowlisting configured.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Require Tailscale/VPN</p>
                <p className="text-sm text-muted-foreground">
                  Only allow connections through Tailscale network
                </p>
              </div>
            </div>
            <Switch
              checked={requireTailscale}
              onCheckedChange={setRequireTailscale}
              disabled={localOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* IP Allowlist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                IP Access Control
              </CardTitle>
              <CardDescription>
                Manage allowed and blocked IP addresses
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">{allowedCount} allowed</Badge>
              <Badge variant="danger">{blockedCount} blocked</Badge>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add IP Rule</DialogTitle>
                    <DialogDescription>
                      Add an IP address or CIDR range to the allowlist or
                      blocklist
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>IP Address or CIDR</Label>
                      <Input placeholder="192.168.1.0/24 or 10.0.0.1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Rule Type</Label>
                      <Select defaultValue="allow">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allow">Allow</SelectItem>
                          <SelectItem value="block">Block</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input placeholder="e.g., Office network" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => setShowAddDialog(false)}>
                      Add Rule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ipRules.map((rule, index) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  rule.type === 'block'
                    ? 'border-danger/30 bg-danger/5'
                    : 'border-success/30 bg-success/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  {rule.type === 'allow' ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-danger" />
                  )}
                  <div>
                    <code className="text-sm font-medium">{rule.ip}</code>
                    <p className="text-xs text-muted-foreground">
                      {rule.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={rule.type === 'allow' ? 'success' : 'danger'}>
                    {rule.type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setIpRules((prev) =>
                        prev.filter((r) => r.id !== rule.id)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rate limiting */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting</CardTitle>
          <CardDescription>
            Protect against abuse with request rate limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Requests per minute</Label>
              <Input type="number" defaultValue={100} />
            </div>
            <div className="space-y-2">
              <Label>Window duration (seconds)</Label>
              <Input type="number" defaultValue={60} />
            </div>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Auto-block after limit</p>
              <p className="text-sm text-muted-foreground">
                Automatically block IPs that exceed rate limits
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Port configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Port Configuration</CardTitle>
          <CardDescription>
            Configure which port Atlas listens on
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1">
              <Label>Listen Port</Label>
              <Input type="number" defaultValue={18789} />
            </div>
            <Alert className="flex-1" variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Ensure port 18789 is not exposed to the public internet
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
