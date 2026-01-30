'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Check,
  X,
  Edit2,
  Undo2,
  Mail,
  Calendar,
  ListTodo,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { DraftItem, DraftSurface } from '@/lib/api/briefings'

interface DraftCardProps {
  draft: DraftItem
  onApprove: (id: string) => Promise<{ undoDeadline: string }>
  onDismiss: (id: string, reason?: string) => Promise<void>
  onEdit: (id: string, content: string) => Promise<{ undoDeadline: string }>
  onUndo: (id: string) => Promise<void>
  className?: string
}

const surfaceIcons: Record<DraftSurface, typeof Mail> = {
  email: Mail,
  calendar: Calendar,
  tasks: ListTodo,
}

const surfaceColors: Record<DraftSurface, string> = {
  email: 'bg-blue-500/10 text-blue-500',
  calendar: 'bg-purple-500/10 text-purple-500',
  tasks: 'bg-green-500/10 text-green-500',
}

export function DraftCard({
  draft,
  onApprove,
  onDismiss,
  onEdit,
  onUndo,
  className,
}: DraftCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(draft.content)
  const [isLoading, setIsLoading] = useState(false)
  const [undoDeadline, setUndoDeadline] = useState<Date | null>(null)
  const [undoRemaining, setUndoRemaining] = useState(0)
  const [showDismissDialog, setShowDismissDialog] = useState(false)
  const [dismissReason, setDismissReason] = useState('')

  const Icon = surfaceIcons[draft.surface]
  const isPending = draft.status === 'pending'
  const canUndo = undoDeadline && undoRemaining > 0

  // Update undo countdown
  useEffect(() => {
    if (!undoDeadline) return

    const interval = setInterval(() => {
      const remaining = Math.max(0, undoDeadline.getTime() - Date.now())
      setUndoRemaining(Math.ceil(remaining / 1000))

      if (remaining <= 0) {
        setUndoDeadline(null)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [undoDeadline])

  const handleApprove = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await onApprove(draft.id)
      setUndoDeadline(new Date(result.undoDeadline))
    } finally {
      setIsLoading(false)
    }
  }, [draft.id, onApprove])

  const handleDismiss = useCallback(async () => {
    setIsLoading(true)
    try {
      await onDismiss(draft.id, dismissReason || undefined)
      setShowDismissDialog(false)
      setDismissReason('')
    } finally {
      setIsLoading(false)
    }
  }, [draft.id, dismissReason, onDismiss])

  const handleEdit = useCallback(async () => {
    if (editContent === draft.content) {
      setIsEditing(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await onEdit(draft.id, editContent)
      setUndoDeadline(new Date(result.undoDeadline))
      setIsEditing(false)
    } finally {
      setIsLoading(false)
    }
  }, [draft.id, editContent, draft.content, onEdit])

  const handleUndo = useCallback(async () => {
    setIsLoading(true)
    try {
      await onUndo(draft.id)
      setUndoDeadline(null)
    } finally {
      setIsLoading(false)
    }
  }, [draft.id, onUndo])

  return (
    <TooltipProvider>
      <Card
        className={cn(
          'transition-all duration-200',
          !isPending && 'opacity-75',
          className
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', surfaceColors[draft.surface])}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{draft.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {draft.type.replace('_', ' ')}
                  </Badge>
                  {draft.priority >= 4 && (
                    <Badge variant="destructive" className="text-xs">
                      High Priority
                    </Badge>
                  )}
                  {draft.status !== 'pending' && (
                    <Badge
                      variant={draft.status === 'approved' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {draft.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {isPending && (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={handleApprove}
                      disabled={isLoading}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Approve</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => setIsEditing(true)}
                      disabled={isLoading}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit & Approve</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setShowDismissDialog(true)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Dismiss</TooltipContent>
                </Tooltip>
              </div>
            )}

            {canUndo && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{undoRemaining}s</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={handleUndo}
                      disabled={isLoading}
                    >
                      <Undo2 className="h-3 w-3 mr-1" />
                      Undo
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Undo this action</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {draft.context && (
            <p className="text-xs text-muted-foreground mb-2">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              {draft.context}
            </p>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[100px] text-sm"
                placeholder="Edit the draft content..."
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false)
                    setEditContent(draft.content)
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleEdit}
                  disabled={isLoading || editContent.trim().length === 0}
                >
                  Save & Approve
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'text-sm whitespace-pre-wrap transition-all',
                  !isExpanded && 'line-clamp-3'
                )}
              >
                {draft.editedContent || draft.content}
              </div>

              {draft.content.length > 200 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 text-xs"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show more
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>

        {/* Dismiss Dialog */}
        <Dialog open={showDismissDialog} onOpenChange={setShowDismissDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dismiss Draft</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Optionally provide a reason for dismissing this draft. This helps
                improve future suggestions.
              </p>
              <Textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Why are you dismissing this? (optional)"
                className="min-h-[80px]"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDismissDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDismiss}
                disabled={isLoading}
              >
                Dismiss
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  )
}

// List of draft cards
interface DraftListProps {
  drafts: DraftItem[]
  onApprove: (id: string) => Promise<{ undoDeadline: string }>
  onDismiss: (id: string, reason?: string) => Promise<void>
  onEdit: (id: string, content: string) => Promise<{ undoDeadline: string }>
  onUndo: (id: string) => Promise<void>
  className?: string
}

export function DraftList({
  drafts,
  onApprove,
  onDismiss,
  onEdit,
  onUndo,
  className,
}: DraftListProps) {
  const pendingDrafts = drafts.filter((d) => d.status === 'pending')
  const resolvedDrafts = drafts.filter((d) => d.status !== 'pending')

  if (drafts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No action items for today</p>
        <p className="text-sm">Check back later for new suggestions</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {pendingDrafts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Action Items ({pendingDrafts.length})
          </h3>
          {pendingDrafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onApprove={onApprove}
              onDismiss={onDismiss}
              onEdit={onEdit}
              onUndo={onUndo}
            />
          ))}
        </div>
      )}

      {resolvedDrafts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Resolved ({resolvedDrafts.length})
          </h3>
          {resolvedDrafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onApprove={onApprove}
              onDismiss={onDismiss}
              onEdit={onEdit}
              onUndo={onUndo}
            />
          ))}
        </div>
      )}
    </div>
  )
}
