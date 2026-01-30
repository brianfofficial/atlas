'use client'

import { Suspense, useState, useCallback } from 'react'
import { DailyBriefing, DailyBriefingSkeleton } from '@/components/briefings/daily-briefing'
import { DraftList } from '@/components/briefings/draft-card'
import { MetricsDashboard } from '@/components/briefings/metrics-dashboard'
import { useAuth } from '@/hooks/use-auth'
import {
  useBriefingRealtime,
  useBriefingNotifications,
} from '@/hooks/use-briefing-events'
import { useNotifications } from '@/components/notifications/notification-center'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTodaysBriefing,
  approveDraft,
  dismissDraft,
  editDraft,
  undoDraft,
  getMetricsDashboard,
} from '@/lib/api/briefings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, BarChart2, CheckSquare, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BriefingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch today's briefing
  const {
    data: briefing,
    isLoading: briefingLoading,
    refetch: refetchBriefing,
  } = useQuery({
    queryKey: ['briefing', 'today'],
    queryFn: getTodaysBriefing,
  })

  // Fetch metrics
  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['briefing', 'metrics'],
    queryFn: getMetricsDashboard,
  })

  // Notifications hook for WebSocket integration
  const { addNotification } = useNotifications()
  useBriefingNotifications(addNotification)

  // Real-time updates
  const { hasPendingNotification, clearNotification, trustAlerts, dismissTrustAlert } =
    useBriefingRealtime({
      onNewBriefing: () => {
        refetchBriefing()
      },
      onDraftStatusChange: (itemId, status) => {
        // Invalidate briefing query to refetch
        queryClient.invalidateQueries({ queryKey: ['briefing', 'today'] })
      },
      onTrustAlert: () => {
        refetchMetrics()
      },
    })

  // Draft action handlers
  const handleApproveDraft = useCallback(async (id: string) => {
    const result = await approveDraft(id)
    return { undoDeadline: result.undoDeadline }
  }, [])

  const handleDismissDraft = useCallback(async (id: string, reason?: string) => {
    await dismissDraft(id, reason)
  }, [])

  const handleEditDraft = useCallback(async (id: string, content: string) => {
    const result = await editDraft(id, content)
    return { undoDeadline: result.undoDeadline }
  }, [])

  const handleUndoDraft = useCallback(async (id: string) => {
    await undoDraft(id)
  }, [])

  const pendingDrafts = briefing?.draftItems.filter((d) => d.status === 'pending') ?? []
  const pendingCount = pendingDrafts.length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* New briefing notification banner */}
      {hasPendingNotification && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <p className="font-medium">A new briefing is available!</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => refetchBriefing()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button size="sm" variant="ghost" onClick={clearNotification}>
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trust alerts */}
      {trustAlerts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4">
            <div className="space-y-2">
              {trustAlerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">{alert.signal.type}</p>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissTrustAlert(index)}
                  >
                    Dismiss
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Actions
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Suspense fallback={<DailyBriefingSkeleton />}>
            <DailyBriefing userName={user?.username} />
          </Suspense>

          {/* Action items preview on overview tab */}
          {pendingCount > 0 && (
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Pending Actions
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('actions')}
                  >
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {briefingLoading ? (
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <DraftList
                    drafts={pendingDrafts.slice(0, 3)}
                    onApprove={handleApproveDraft}
                    onDismiss={handleDismissDraft}
                    onEdit={handleEditDraft}
                    onUndo={handleUndoDraft}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="actions" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Action Items</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review and approve suggested actions from your briefing
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchBriefing()}
                  disabled={briefingLoading}
                >
                  <RefreshCw
                    className={cn('h-4 w-4 mr-2', briefingLoading && 'animate-spin')}
                  />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {briefingLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-lg" />
                  ))}
                </div>
              ) : (
                <DraftList
                  drafts={briefing?.draftItems ?? []}
                  onApprove={handleApproveDraft}
                  onDismiss={handleDismissDraft}
                  onEdit={handleEditDraft}
                  onUndo={handleUndoDraft}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <MetricsDashboard
            data={metrics}
            isLoading={metricsLoading}
            onRefresh={() => refetchMetrics()}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
