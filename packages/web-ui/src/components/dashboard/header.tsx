'use client'

import Link from 'next/link'
import {
  User,
  LogOut,
  Settings,
  Smartphone,
  Brain,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MemoryPanel } from '@/components/memory/memory-panel'
import {
  NotificationCenter,
  useNotifications,
  createDemoNotifications,
} from '@/components/notifications/notification-center'
import { useAuthContext } from '@/components/auth/auth-provider'

interface HeaderProps {
  sidebarCollapsed: boolean
}

export function Header({ sidebarCollapsed }: HeaderProps) {
  const { user, logout, isLoggingOut } = useAuthContext()

  // Initialize notifications with demo data (in production, this would come from API/WebSocket)
  const {
    notifications,
    markRead,
    markAllRead,
    dismiss,
  } = useNotifications({ initialNotifications: createDemoNotifications() })

  const userInitials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U'

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Left side - breadcrumb or search could go here */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1">
              <Shield className="h-3 w-3" />
              Secure
            </Badge>
          </div>
        </div>

        {/* Right side - actions */}
        <div className="flex items-center gap-2">
          {/* Memory Panel */}
          <MemoryPanel
            trigger={
              <Button variant="ghost" size="icon" title="Atlas Memory">
                <Brain className="h-5 w-5" />
              </Button>
            }
          />

          {/* Notifications */}
          <NotificationCenter
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onDismiss={dismiss}
          />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium">
                  {user?.username || 'User'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.username || 'User'}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user?.email || 'No email'}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/devices">
                  <Smartphone className="mr-2 h-4 w-4" />
                  Devices
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger focus:text-danger"
                onClick={() => logout()}
                disabled={isLoggingOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
