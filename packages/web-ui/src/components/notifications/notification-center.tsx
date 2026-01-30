'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  Check,
  X,
  AlertTriangle,
  Shield,
  DollarSign,
  Calendar,
  Mail,
  MessageSquare,
  Settings,
  ExternalLink,
  CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { formatDistanceToNow } from 'date-fns'

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | 'approval_request'
  | 'security_alert'
  | 'daily_digest'
  | 'budget_warning'
  | 'briefing_ready'
  | 'draft_executed'
  | 'system'

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  read: boolean
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// ============================================================================
// Notification Icons and Colors
// ============================================================================

const notificationIcons: Record<NotificationType, typeof Bell> = {
  approval_request: Check,
  security_alert: Shield,
  daily_digest: Calendar,
  budget_warning: DollarSign,
  briefing_ready: Mail,
  draft_executed: CheckCheck,
  system: Bell,
}

const priorityColors: Record<NotificationPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-500',
  high: 'bg-yellow-500/10 text-yellow-500',
  urgent: 'bg-red-500/10 text-red-500',
}

const priorityBadgeVariants: Record<NotificationPriority, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'outline',
  high: 'default',
  urgent: 'destructive',
}

// ============================================================================
// Notification Center Component
// ============================================================================

interface NotificationCenterProps {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
  onAction?: (notification: Notification) => void
  className?: string
}

export function NotificationCenter({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onAction,
  className,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
        <NotificationPanel
          notifications={notifications}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onDismiss={onDismiss}
          onAction={onAction}
          onClose={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// Notification Panel
// ============================================================================

interface NotificationPanelProps {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
  onAction?: (notification: Notification) => void
  onClose: () => void
}

function NotificationPanel({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onAction,
  onClose,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="flex flex-col max-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {unreadCount} unread
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onMarkAllRead}
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark all as read</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <ScrollArea className="flex-1">
        {sortedNotifications.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="divide-y">
            {sortedNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={onMarkRead}
                onDismiss={onDismiss}
                onAction={onAction}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => {
            // Navigate to full notifications page
            onClose()
          }}
        >
          <Settings className="h-3 w-3 mr-1" />
          Notification Settings
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Notification Item
// ============================================================================

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
  onAction?: (notification: Notification) => void
}

function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onAction,
}: NotificationItemProps) {
  const Icon = notificationIcons[notification.type]
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })

  const handleClick = useCallback(() => {
    if (!notification.read) {
      onMarkRead(notification.id)
    }
    if (notification.actionUrl || onAction) {
      onAction?.(notification)
    }
  }, [notification, onMarkRead, onAction])

  return (
    <div
      className={cn(
        'px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer',
        !notification.read && 'bg-primary/5'
      )}
      onClick={handleClick}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
            priorityColors[notification.priority]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm', !notification.read && 'font-medium')}>
                {notification.title}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {notification.message}
              </p>
            </div>

            {/* Dismiss button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDismiss(notification.id)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Dismiss</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {notification.priority === 'urgent' && (
              <Badge variant="destructive" className="text-[10px] px-1 h-4">
                Urgent
              </Badge>
            )}
            {notification.priority === 'high' && (
              <Badge variant="default" className="text-[10px] px-1 h-4">
                High
              </Badge>
            )}
            {notification.actionUrl && (
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Unread indicator */}
        {!notification.read && (
          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Hook for managing notifications state
// ============================================================================

interface UseNotificationsOptions {
  initialNotifications?: Notification[]
  onWebSocketMessage?: (message: unknown) => Notification | null
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<Notification[]>(
    options.initialNotifications || []
  )

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev])
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    addNotification,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
  }
}

// ============================================================================
// Demo/Placeholder Notifications
// ============================================================================

export function createDemoNotifications(): Notification[] {
  const now = new Date()
  return [
    {
      id: '1',
      type: 'approval_request',
      title: 'Approval Required',
      message: 'A new shell command requires your approval: npm install lodash',
      priority: 'high',
      read: false,
      actionUrl: '/approvals',
      createdAt: new Date(now.getTime() - 5 * 60000).toISOString(),
    },
    {
      id: '2',
      type: 'security_alert',
      title: 'Security Alert',
      message: 'Potential prompt injection detected and blocked',
      priority: 'urgent',
      read: false,
      createdAt: new Date(now.getTime() - 15 * 60000).toISOString(),
    },
    {
      id: '3',
      type: 'briefing_ready',
      title: 'Daily Briefing Ready',
      message: 'Your daily briefing is ready. You have 3 meetings and 5 emails to review.',
      priority: 'medium',
      read: true,
      actionUrl: '/briefings',
      createdAt: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
    {
      id: '4',
      type: 'budget_warning',
      title: 'Budget Warning',
      message: "You've used 80% of your daily AI budget ($4.00 / $5.00)",
      priority: 'medium',
      read: true,
      actionUrl: '/costs',
      createdAt: new Date(now.getTime() - 120 * 60000).toISOString(),
    },
  ]
}
