'use client'

import { useState, useEffect } from 'react'
import {
  Github,
  GitPullRequest,
  GitCommit,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MessageSquare,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface PullRequest {
  id: string
  number: number
  title: string
  repo: string
  author: {
    name: string
    avatar?: string
  }
  status: 'open' | 'draft' | 'merged' | 'closed'
  ciStatus?: 'passing' | 'failing' | 'pending' | 'none'
  reviewStatus?: 'approved' | 'changes_requested' | 'pending' | 'none'
  comments: number
  updatedAt: Date
  url: string
}

interface GitHubData {
  prsAwaitingReview: PullRequest[]
  myOpenPRs: PullRequest[]
  recentCommits: number
  notifications: number
}

interface GitHubWidgetProps {
  className?: string
  data?: GitHubData
  isLoading?: boolean
  onRefresh?: () => void
  onPRClick?: (pr: PullRequest) => void
}

export function GitHubWidget({
  className,
  data,
  isLoading,
  onRefresh,
  onPRClick,
}: GitHubWidgetProps) {
  const [activeTab, setActiveTab] = useState<'review' | 'mine'>('review')

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
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
            <Github className="h-4 w-4" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Github className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Connect GitHub to see your PRs</p>
            <Button variant="outline" size="sm" className="mt-3">
              Connect GitHub
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const activePRs = activeTab === 'review' ? data.prsAwaitingReview : data.myOpenPRs

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub
          </CardTitle>
          <div className="flex items-center gap-1">
            {data.notifications > 0 && (
              <Badge variant="default" className="text-xs">
                {data.notifications} new
              </Badge>
            )}
            {onRefresh && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveTab('review')}
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeTab === 'review'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              To Review
              {data.prsAwaitingReview.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {data.prsAwaitingReview.length}
                </Badge>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeTab === 'mine'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <GitPullRequest className="h-3.5 w-3.5" />
              My PRs
              {data.myOpenPRs.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {data.myOpenPRs.length}
                </Badge>
              )}
            </span>
          </button>
        </div>

        {/* PR list */}
        <div className="space-y-1">
          {activePRs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <GitPullRequest className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {activeTab === 'review'
                  ? 'No PRs awaiting your review'
                  : 'No open pull requests'}
              </p>
            </div>
          ) : (
            activePRs.slice(0, 4).map((pr) => (
              <PRItem key={pr.id} pr={pr} onClick={() => onPRClick?.(pr)} />
            ))
          )}
        </div>

        {/* Recent activity */}
        {data.recentCommits > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
            <GitCommit className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {data.recentCommits} commits today
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface PRItemProps {
  pr: PullRequest
  onClick?: () => void
}

function PRItem({ pr, onClick }: PRItemProps) {
  const CIIcon = {
    passing: CheckCircle,
    failing: XCircle,
    pending: Clock,
    none: null,
  }[pr.ciStatus || 'none']

  const ciColor = {
    passing: 'text-success',
    failing: 'text-danger',
    pending: 'text-warning',
    none: '',
  }[pr.ciStatus || 'none']

  const reviewColor = {
    approved: 'text-success',
    changes_requested: 'text-danger',
    pending: 'text-warning',
    none: '',
  }[pr.reviewStatus || 'none']

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-2 rounded-lg text-left hover:bg-muted transition-colors"
    >
      <Avatar className="h-8 w-8 shrink-0">
        {pr.author.avatar ? (
          <AvatarImage src={pr.author.avatar} alt={pr.author.name} />
        ) : (
          <AvatarFallback>{pr.author.name[0]}</AvatarFallback>
        )}
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{pr.title}</span>
          {pr.status === 'draft' && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              Draft
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span className="truncate">{pr.repo}</span>
          <span>#{pr.number}</span>
          <span>·</span>
          <span>{formatRelativeTime(pr.updatedAt)}</span>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 mt-1">
          {CIIcon && (
            <span className={cn('flex items-center gap-1 text-xs', ciColor)}>
              <CIIcon className="h-3 w-3" />
              CI
            </span>
          )}
          {pr.reviewStatus && pr.reviewStatus !== 'none' && (
            <span className={cn('flex items-center gap-1 text-xs', reviewColor)}>
              <Eye className="h-3 w-3" />
              {pr.reviewStatus === 'approved'
                ? 'Approved'
                : pr.reviewStatus === 'changes_requested'
                ? 'Changes'
                : 'Review'}
            </span>
          )}
          {pr.comments > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {pr.comments}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
    </button>
  )
}

// Hook for fetching GitHub data
export function useGitHub() {
  const [data, setData] = useState<GitHubData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGitHub = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // This would call the actual GitHub API
      await new Promise((resolve) => setTimeout(resolve, 500))

      const now = new Date()

      setData({
        prsAwaitingReview: [
          {
            id: '1',
            number: 142,
            title: 'Add user authentication flow',
            repo: 'atlas/web-ui',
            author: { name: 'Sarah Chen' },
            status: 'open',
            ciStatus: 'passing',
            reviewStatus: 'pending',
            comments: 3,
            updatedAt: new Date(now.getTime() - 30 * 60 * 1000),
            url: 'https://github.com/atlas/web-ui/pull/142',
          },
          {
            id: '2',
            number: 98,
            title: 'Fix memory leak in dashboard',
            repo: 'atlas/gateway',
            author: { name: 'Alex Kim' },
            status: 'open',
            ciStatus: 'failing',
            reviewStatus: 'changes_requested',
            comments: 7,
            updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            url: 'https://github.com/atlas/gateway/pull/98',
          },
        ],
        myOpenPRs: [
          {
            id: '3',
            number: 145,
            title: 'Update dependencies and fix security issues',
            repo: 'atlas/web-ui',
            author: { name: 'You' },
            status: 'open',
            ciStatus: 'passing',
            reviewStatus: 'approved',
            comments: 2,
            updatedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            url: 'https://github.com/atlas/web-ui/pull/145',
          },
          {
            id: '4',
            number: 143,
            title: '[WIP] Implement command palette',
            repo: 'atlas/web-ui',
            author: { name: 'You' },
            status: 'draft',
            ciStatus: 'pending',
            reviewStatus: 'none',
            comments: 0,
            updatedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
            url: 'https://github.com/atlas/web-ui/pull/143',
          },
        ],
        recentCommits: 5,
        notifications: 3,
      })
    } catch (err) {
      setError('Failed to load GitHub data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchGitHub()
  }, [])

  return { data, isLoading, error, refresh: fetchGitHub }
}
