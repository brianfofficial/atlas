'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, Bell, Loader2 } from 'lucide-react'
import { ApprovalCard } from './approval-card'
import { ApprovalRequest } from '@/hooks/use-approvals'
import { Skeleton } from '@/components/ui/skeleton'

interface ApprovalQueueListProps {
  approvals: ApprovalRequest[]
  isLoading?: boolean
  onApprove: (id: string, remember: boolean) => void
  onDeny: (id: string) => void
  processingIds?: Set<string>
}

/**
 * Approval Queue List
 *
 * Displays a list of pending approvals with animations.
 */
export function ApprovalQueueList({
  approvals,
  isLoading = false,
  onApprove,
  onDeny,
  processingIds = new Set(),
}: ApprovalQueueListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    )
  }

  if (approvals.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-lg font-medium">All clear!</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          No pending approvals. You'll be notified when Atlas needs your permission.
        </p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {approvals.map((approval, index) => (
          <motion.div
            key={approval.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 40,
              delay: index * 0.05,
            }}
          >
            <ApprovalCard
              approval={approval}
              onApprove={onApprove}
              onDeny={onDeny}
              isProcessing={processingIds.has(approval.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Approval notification badge for nav/header
 */
export function ApprovalBadge({ count }: { count: number }) {
  if (count === 0) return null

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-danger text-danger-foreground text-xs font-medium flex items-center justify-center"
    >
      {count > 99 ? '99+' : count}
    </motion.div>
  )
}

/**
 * Approval notification indicator
 */
export function ApprovalIndicator({
  count,
  isConnected,
}: {
  count: number
  isConnected: boolean
}) {
  return (
    <div className="relative">
      <Bell className="w-5 h-5" />
      {!isConnected && (
        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warning" />
      )}
      <ApprovalBadge count={count} />
    </div>
  )
}

/**
 * Loading indicator for processing
 */
export function ProcessingOverlay() {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  )
}
