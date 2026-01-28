'use client'

import Link from 'next/link'
import {
  Bell,
  User,
  LogOut,
  Settings,
  Smartphone,
  Moon,
  Sun,
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

interface HeaderProps {
  sidebarCollapsed: boolean
}

export function Header({ sidebarCollapsed }: HeaderProps) {
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
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-danger text-[10px] font-medium text-danger-foreground flex items-center justify-center">
                  3
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-96 overflow-auto">
                {[
                  {
                    title: 'New device paired',
                    description: 'MacBook Pro was added to your account',
                    time: '2 min ago',
                    type: 'info',
                  },
                  {
                    title: 'Failed login attempt',
                    description: 'Blocked from unknown IP 192.168.1.100',
                    time: '1 hour ago',
                    type: 'warning',
                  },
                  {
                    title: 'Credential rotation reminder',
                    description: '3 credentials are older than 90 days',
                    time: '1 day ago',
                    type: 'warning',
                  },
                ].map((notification, i) => (
                  <DropdownMenuItem
                    key={i}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`status-dot ${
                          notification.type === 'warning'
                            ? 'status-dot-warning'
                            : 'status-dot-success'
                        }`}
                      />
                      <span className="font-medium text-sm">
                        {notification.title}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {notification.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {notification.time}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center text-primary">
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    AD
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium">
                  Admin
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>Admin User</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    admin@example.com
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
              <DropdownMenuItem className="text-danger focus:text-danger">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
