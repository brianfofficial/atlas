'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Trash2,
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
  Brain,
  User,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatRelativeTime } from '@/lib/utils'
import type { MemoryEntry as MemoryEntryType } from '@/lib/api/memory'

const typeIcons = {
  fact: Brain,
  preference: User,
  context: MessageSquare,
  instruction: Settings,
  skill: Sparkles,
  relationship: Users,
}

const importanceColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-500',
  high: 'bg-amber-500/10 text-amber-500',
  critical: 'bg-red-500/10 text-red-500',
}

interface MemoryEntryProps {
  memory: MemoryEntryType
  onDelete?: (id: string) => void
  isDeleting?: boolean
}

export function MemoryEntry({ memory, onDelete, isDeleting }: MemoryEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = typeIcons[memory.type] || Brain

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
    >
      <Card className="group hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="p-2 rounded-lg bg-muted shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs capitalize">
                  {memory.type}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-xs ${importanceColors[memory.importance]}`}
                >
                  {memory.importance}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(new Date(memory.createdAt))}
                </span>
              </div>

              {/* Summary or truncated content */}
              <p className="text-sm text-foreground">
                {memory.summary || memory.content.slice(0, 150)}
                {!memory.summary && memory.content.length > 150 && '...'}
              </p>

              {/* Expanded content */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t"
                >
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {memory.content}
                  </p>

                  {/* Tags */}
                  {memory.tags && memory.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {memory.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span>Source: {memory.source}</span>
                    <span>Accessed: {memory.accessCount} times</span>
                    {memory.lastAccessedAt && (
                      <span>
                        Last accessed:{' '}
                        {formatRelativeTime(new Date(memory.lastAccessedAt))}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-danger"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Memory</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this memory. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(memory.id)}
                        className="bg-danger text-danger-foreground hover:bg-danger/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
