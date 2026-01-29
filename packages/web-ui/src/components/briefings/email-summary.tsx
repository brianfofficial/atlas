'use client'

import { useState, useEffect } from 'react'
import {
  Mail,
  Inbox,
  Star,
  Flag,
  Users,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface EmailThread {
  id: string
  from: {
    name: string
    email: string
    avatar?: string
  }
  subject: string
  snippet: string
  receivedAt: Date
  isUnread?: boolean
  isStarred?: boolean
  isFlagged?: boolean
  isVIP?: boolean
  labels?: string[]
}

interface EmailSummaryData {
  unreadCount: number
  starredCount: number
  flaggedCount: number
  recentThreads: EmailThread[]
  vipSenders: string[]
}

interface EmailSummaryProps {
  className?: string
  data?: EmailSummaryData
  isLoading?: boolean
  onRefresh?: () => void
  onOpenInbox?: () => void
  onThreadClick?: (thread: EmailThread) => void
}

export function EmailSummary({
  className,
  data,
  isLoading,
  onRefresh,
  onOpenInbox,
  onThreadClick,
}: EmailSummaryProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 flex-1 rounded-lg" />
            ))}
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Connect your email to see inbox summary</p>
            <Button variant="outline" size="sm" className="mt-3">
              Connect Gmail
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </CardTitle>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            {onOpenInbox && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenInbox}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={Inbox}
            label="Unread"
            value={data.unreadCount}
            highlight={data.unreadCount > 0}
          />
          <StatCard icon={Star} label="Starred" value={data.starredCount} />
          <StatCard
            icon={Flag}
            label="Flagged"
            value={data.flaggedCount}
            highlight={data.flaggedCount > 0}
            variant="warning"
          />
        </div>

        {/* VIP Senders */}
        {data.vipSenders.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 text-sm">
            <Users className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground">VIP emails from:</span>
            <span className="font-medium truncate">
              {data.vipSenders.slice(0, 2).join(', ')}
              {data.vipSenders.length > 2 && ` +${data.vipSenders.length - 2}`}
            </span>
          </div>
        )}

        {/* Recent threads */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2">Recent</p>
          {data.recentThreads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent emails
            </p>
          ) : (
            data.recentThreads.slice(0, 4).map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                onClick={() => onThreadClick?.(thread)}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  highlight?: boolean
  variant?: 'default' | 'warning'
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
  variant = 'default',
}: StatCardProps) {
  return (
    <div
      className={cn(
        'p-2 rounded-lg text-center',
        highlight
          ? variant === 'warning'
            ? 'bg-warning/10'
            : 'bg-primary/10'
          : 'bg-muted/50'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 mx-auto mb-1',
          highlight
            ? variant === 'warning'
              ? 'text-warning'
              : 'text-primary'
            : 'text-muted-foreground'
        )}
      />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

interface ThreadItemProps {
  thread: EmailThread
  onClick?: () => void
}

function ThreadItem({ thread, onClick }: ThreadItemProps) {
  const initials = thread.from.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors hover:bg-muted',
        thread.isUnread && 'bg-primary/5'
      )}
    >
      <Avatar className="h-9 w-9 shrink-0">
        {thread.from.avatar ? (
          <img src={thread.from.avatar} alt={thread.from.name} />
        ) : (
          <AvatarFallback className={thread.isVIP ? 'bg-primary/10 text-primary' : ''}>
            {initials}
          </AvatarFallback>
        )}
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm truncate',
              thread.isUnread ? 'font-semibold' : 'font-medium'
            )}
          >
            {thread.from.name}
          </span>
          {thread.isVIP && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              VIP
            </Badge>
          )}
          {thread.isStarred && <Star className="h-3 w-3 text-warning fill-warning" />}
          {thread.isFlagged && <Flag className="h-3 w-3 text-danger" />}
        </div>
        <p className={cn('text-sm truncate', thread.isUnread ? 'font-medium' : '')}>
          {thread.subject}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{thread.snippet}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0">{formatRelativeTime(thread.receivedAt)}</span>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
    </button>
  )
}

// Hook for fetching email data
export function useEmailSummary() {
  const [data, setData] = useState<EmailSummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  const fetchEmail = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Import the Gmail API client dynamically
      const { isGmailConnected, getInboxSummary, getVIPSenders } = await import('@/lib/api/gmail')

      // Check if Gmail is connected
      const connected = await isGmailConnected()
      setIsConnected(connected)

      if (!connected) {
        // Return null if not connected - UI will show connection prompt
        setData(null)
        return
      }

      // Fetch real inbox summary and VIP senders
      const [inboxSummary, vipSenders] = await Promise.all([
        getInboxSummary(),
        getVIPSenders().catch(() => []),
      ])

      // Transform API threads to widget format
      const recentThreads: EmailThread[] = inboxSummary.recentThreads
        .slice(0, 5)
        .map((thread) => {
          const firstMessage = thread.messages[0]
          const isVIP = vipSenders.some(
            (vip) => vip.toLowerCase() === firstMessage?.from?.email?.toLowerCase()
          )

          return {
            id: thread.id,
            from: {
              name: firstMessage?.from?.name || firstMessage?.from?.email || 'Unknown',
              email: firstMessage?.from?.email || '',
            },
            subject: firstMessage?.subject || thread.snippet,
            snippet: thread.snippet,
            receivedAt: new Date(firstMessage?.date || Date.now()),
            isUnread: firstMessage?.isUnread ?? false,
            isStarred: firstMessage?.isStarred ?? false,
            isFlagged: firstMessage?.labelIds?.includes('IMPORTANT') ?? false,
            isVIP,
          }
        })

      setData({
        unreadCount: inboxSummary.unreadCount,
        starredCount: inboxSummary.starredCount,
        flaggedCount: inboxSummary.importantCount || 0,
        vipSenders: vipSenders.slice(0, 5),
        recentThreads,
      })
    } catch (err) {
      console.error('Email fetch error:', err)
      setError('Failed to load email')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEmail()
  }, [])

  return { data, isLoading, error, isConnected, refresh: fetchEmail }
}
