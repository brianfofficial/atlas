'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Clock,
  Check,
  X,
  RefreshCw,
  History,
  Settings2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/ui/stats-card'
import { ApprovalQueueList, ApprovalIndicator } from '@/components/approvals/approval-queue-list'
import { BulkApproveDialog } from '@/components/approvals/approval-actions'
import { useApprovals } from '@/hooks/use-approvals'
import { useWebSocket } from '@/hooks/use-websocket'

export default function ApprovalsPage() {
  const {
    pending,
    stats,
    isLoading,
    approve,
    deny,
    isApproving,
    isDenying,
    refetch,
  } = useApprovals()
  const { isConnected } = useWebSocket()

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [showBulkApprove, setShowBulkApprove] = useState(false)

  const handleApprove = useCallback(
    async (id: string, remember: boolean) => {
      setProcessingIds((prev) => new Set([...prev, id]))
      try {
        await approve(id, remember)
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [approve]
  )

  const handleDeny = useCallback(
    async (id: string) => {
      setProcessingIds((prev) => new Set([...prev, id]))
      try {
        await deny(id)
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [deny]
  )

  const handleBulkApprove = async () => {
    for (const approval of pending) {
      await handleApprove(approval.id, false)
    }
    setShowBulkApprove(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve pending operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <Badge
            variant={isConnected ? 'success' : 'secondary'}
            className="gap-1"
          >
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                Offline
              </>
            )}
          </Badge>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Link href="/approvals/history">
            <Button variant="outline" size="sm">
              <History className="w-4 h-4 mr-1" />
              History
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <StatsCard
            title="Pending"
            value={stats?.pending ?? 0}
            description="Awaiting your decision"
            icon={Clock}
            status={stats?.pending && stats.pending > 0 ? 'warning' : 'success'}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatsCard
            title="Approved Today"
            value={stats?.approvedToday ?? 0}
            description="Including auto-approved"
            icon={Check}
            status="success"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatsCard
            title="Denied Today"
            value={stats?.deniedToday ?? 0}
            description="Blocked operations"
            icon={X}
            status={stats?.deniedToday && stats.deniedToday > 0 ? 'warning' : 'success'}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatsCard
            title="Auto-Approved"
            value={stats?.autoApprovedToday ?? 0}
            description="By trusted rules"
            icon={Shield}
            status="success"
          />
        </motion.div>
      </div>

      {/* Quick actions */}
      {pending.length > 1 && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-background-secondary border border-border">
          <span className="text-sm text-muted-foreground">
            {pending.length} pending approvals
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkApprove(true)}
          >
            Approve All
          </Button>
        </div>
      )}

      {/* Approval queue */}
      <ApprovalQueueList
        approvals={pending}
        isLoading={isLoading}
        onApprove={handleApprove}
        onDeny={handleDeny}
        processingIds={processingIds}
      />

      {/* Bulk approve dialog */}
      <BulkApproveDialog
        open={showBulkApprove}
        onClose={() => setShowBulkApprove(false)}
        count={pending.length}
        onConfirm={handleBulkApprove}
        isProcessing={isApproving}
      />
    </div>
  )
}
