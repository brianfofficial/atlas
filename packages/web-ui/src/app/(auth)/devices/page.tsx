'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  MoreVertical,
  Trash2,
  Shield,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'

interface Device {
  id: string
  name: string
  type: 'laptop' | 'phone' | 'tablet' | 'desktop'
  os: string
  browser: string
  location: string
  lastSeen: Date
  isCurrent: boolean
  isTrusted: boolean
}

const MOCK_DEVICES: Device[] = [
  {
    id: '1',
    name: 'MacBook Pro',
    type: 'laptop',
    os: 'macOS 15.2',
    browser: 'Chrome 121',
    location: 'New York, US',
    lastSeen: new Date(),
    isCurrent: true,
    isTrusted: true,
  },
  {
    id: '2',
    name: 'iPhone 15 Pro',
    type: 'phone',
    os: 'iOS 18.2',
    browser: 'Safari',
    location: 'New York, US',
    lastSeen: new Date(Date.now() - 1000 * 60 * 30),
    isCurrent: false,
    isTrusted: true,
  },
  {
    id: '3',
    name: 'Windows Desktop',
    type: 'desktop',
    os: 'Windows 11',
    browser: 'Edge 121',
    location: 'Boston, US',
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    isCurrent: false,
    isTrusted: false,
  },
]

const deviceIcons = {
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>(MOCK_DEVICES)
  const [revokeDevice, setRevokeDevice] = useState<Device | null>(null)

  const handleRevoke = (device: Device) => {
    setDevices((prev) => prev.filter((d) => d.id !== device.id))
    setRevokeDevice(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paired Devices</h1>
        <p className="text-muted-foreground">
          Manage devices that have access to your Atlas account
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Device Trust
          </CardTitle>
          <CardDescription>
            Each device is cryptographically paired using RSA-2048 keys. Maximum
            10 devices per account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {devices.length} of 10 device slots used
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(devices.length / 10) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {devices.map((device, index) => {
          const Icon = deviceIcons[device.type]

          return (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={device.isCurrent ? 'border-primary/50' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-lg ${
                          device.isTrusted
                            ? 'bg-success/10'
                            : 'bg-warning/10'
                        }`}
                      >
                        <Icon
                          className={`h-6 w-6 ${
                            device.isTrusted
                              ? 'text-success'
                              : 'text-warning'
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{device.name}</h3>
                          {device.isCurrent && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                          {device.isTrusted ? (
                            <Badge
                              variant="success"
                              className="text-xs flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Trusted
                            </Badge>
                          ) : (
                            <Badge
                              variant="warning"
                              className="text-xs flex items-center gap-1"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Unverified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {device.os} · {device.browser}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {device.location} ·{' '}
                          {device.isCurrent
                            ? 'Active now'
                            : formatRelativeTime(device.lastSeen)}
                        </p>
                      </div>
                    </div>
                    {!device.isCurrent && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-danger focus:text-danger"
                            onClick={() => setRevokeDevice(device)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Revoke access
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Dialog open={!!revokeDevice} onOpenChange={() => setRevokeDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke device access?</DialogTitle>
            <DialogDescription>
              This will immediately sign out{' '}
              <strong>{revokeDevice?.name}</strong> and remove its trusted
              status. The device will need to re-authenticate with MFA to regain
              access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDevice(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeDevice && handleRevoke(revokeDevice)}
            >
              Revoke access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
