'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, CheckCheck, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BulkApproveDialogProps {
  open: boolean
  onClose: () => void
  count: number
  onConfirm: () => void
  isProcessing?: boolean
}

/**
 * Bulk Approve Confirmation Dialog
 */
export function BulkApproveDialog({
  open,
  onClose,
  count,
  onConfirm,
  isProcessing = false,
}: BulkApproveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-success" />
            Approve All Pending?
          </DialogTitle>
          <DialogDescription>
            This will approve {count} pending {count === 1 ? 'request' : 'requests'}.
            Make sure you've reviewed them all.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-warning">
            Bulk approving may include high-risk operations.
            Consider reviewing each request individually.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={onConfirm}
            disabled={isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Approve All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DenyDialogProps {
  open: boolean
  onClose: () => void
  operation: string
  onConfirm: (reason: string) => void
  isProcessing?: boolean
}

/**
 * Deny with Reason Dialog
 */
export function DenyDialog({
  open,
  onClose,
  operation,
  onConfirm,
  isProcessing = false,
}: DenyDialogProps) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    onConfirm(reason)
    setReason('')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-danger" />
            Deny Request?
          </DialogTitle>
          <DialogDescription>
            You're denying: <strong>{operation}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deny-reason">
              Reason (optional)
            </Label>
            <Input
              id="deny-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you denying this request?"
            />
            <p className="text-xs text-muted-foreground">
              This helps improve Atlas's understanding of your preferences.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              />
            ) : (
              <X className="w-4 h-4" />
            )}
            Deny Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface BulkActionsBarProps {
  selectedCount: number
  onApproveAll: () => void
  onDenyAll: () => void
  onClearSelection: () => void
}

/**
 * Bulk Actions Floating Bar
 */
export function BulkActionsBar({
  selectedCount,
  onApproveAll,
  onDenyAll,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-background-secondary border border-border shadow-lg">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          className="text-muted-foreground"
        >
          Clear
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDenyAll}
          className="gap-1"
        >
          <X className="w-3 h-3" />
          Deny All
        </Button>
        <Button
          size="sm"
          onClick={onApproveAll}
          className="gap-1"
        >
          <Check className="w-3 h-3" />
          Approve All
        </Button>
      </div>
    </motion.div>
  )
}
