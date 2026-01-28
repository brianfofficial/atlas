'use client'

import { useState } from 'react'
import {
  User,
  Shield,
  Bell,
  Palette,
  Database,
  Download,
  Trash2,
  Save,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    securityAlerts: true,
    budgetAlerts: true,
    weeklyReports: false,
    executionLogs: true,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Atlas dashboard preferences
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Manage your account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input defaultValue="Admin User" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" defaultValue="admin@example.com" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>
                Manage your security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    TOTP authenticator enabled
                  </p>
                </div>
                <Button variant="outline">Manage 2FA</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">
                    Last changed 30 days ago
                  </p>
                </div>
                <Button variant="outline">Change</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-sm text-muted-foreground">
                    2 devices currently active
                  </p>
                </div>
                <Button variant="outline">View Sessions</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Backup Codes</p>
                  <p className="text-sm text-muted-foreground">
                    8 codes remaining
                  </p>
                </div>
                <Button variant="outline">View Codes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose what notifications you receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Security Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Failed logins, new devices, suspicious activity
                  </p>
                </div>
                <Switch
                  checked={notifications.securityAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({
                      ...prev,
                      securityAlerts: checked,
                    }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Budget Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Spending threshold warnings
                  </p>
                </div>
                <Switch
                  checked={notifications.budgetAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({
                      ...prev,
                      budgetAlerts: checked,
                    }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Reports</p>
                  <p className="text-sm text-muted-foreground">
                    Summary of activity and costs
                  </p>
                </div>
                <Switch
                  checked={notifications.weeklyReports}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({
                      ...prev,
                      weeklyReports: checked,
                    }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Execution Logs</p>
                  <p className="text-sm text-muted-foreground">
                    Sandbox execution results
                  </p>
                </div>
                <Switch
                  checked={notifications.executionLogs}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({
                      ...prev,
                      executionLogs: checked,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme
              </CardTitle>
              <CardDescription>
                Customize the dashboard appearance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Color Theme</Label>
                <Select defaultValue="dark">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  {[
                    { name: 'Indigo', color: '#6366f1' },
                    { name: 'Purple', color: '#a855f7' },
                    { name: 'Blue', color: '#3b82f6' },
                    { name: 'Green', color: '#10b981' },
                    { name: 'Orange', color: '#f97316' },
                  ].map((accent) => (
                    <button
                      key={accent.name}
                      className="w-8 h-8 rounded-full border-2 border-transparent hover:border-foreground transition-colors"
                      style={{ backgroundColor: accent.color }}
                      title={accent.name}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sidebar</Label>
                <Select defaultValue="expanded">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expanded">Expanded by default</SelectItem>
                    <SelectItem value="collapsed">Collapsed by default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>
                Export or delete your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-sm text-muted-foreground">
                    Download all your data as JSON
                  </p>
                </div>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Export Audit Logs</p>
                  <p className="text-sm text-muted-foreground">
                    Download security event logs
                  </p>
                </div>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-danger">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Account?</DialogTitle>
                      <DialogDescription>
                        This will permanently delete your account and all
                        associated data. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <Alert variant="danger">
                      <AlertDescription>
                        All credentials, settings, and logs will be permanently
                        deleted.
                      </AlertDescription>
                    </Alert>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button variant="destructive">
                        Yes, delete my account
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
