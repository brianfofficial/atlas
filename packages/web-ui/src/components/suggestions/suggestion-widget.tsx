'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  X,
  Minus,
  ChevronUp,
  ChevronDown,
  Settings,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSuggestions } from '@/hooks/use-suggestions'
import { SuggestionCard } from './suggestion-card'

interface SuggestionWidgetProps {
  defaultExpanded?: boolean
  position?: 'bottom-right' | 'bottom-left'
}

export function SuggestionWidget({
  defaultExpanded = false,
  position = 'bottom-right',
}: SuggestionWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isMinimized, setIsMinimized] = useState(false)
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false)

  const {
    suggestions,
    count,
    isLoading,
    dismiss,
    snooze,
    act,
    isDismissing,
    isSnoozing,
    isActing,
  } = useSuggestions()

  // Track new suggestions
  useEffect(() => {
    if (count > 0 && !isExpanded) {
      setHasNewSuggestions(true)
    }
  }, [count, isExpanded])

  // Clear new indicator when expanded
  useEffect(() => {
    if (isExpanded) {
      setHasNewSuggestions(false)
    }
  }, [isExpanded])

  // Hide widget if no suggestions and not loading
  if (!isLoading && count === 0) {
    return null
  }

  const positionClasses =
    position === 'bottom-right' ? 'right-4' : 'left-4'

  // Minimized state - just a floating button
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className={`fixed bottom-4 ${positionClasses} z-50`}
      >
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg relative"
          onClick={() => setIsMinimized(false)}
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="danger"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs"
            >
              {count}
            </Badge>
          )}
          {hasNewSuggestions && (
            <span className="absolute top-0 right-0 h-3 w-3 bg-primary rounded-full animate-ping" />
          )}
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-4 ${positionClasses} z-50 w-[380px]`}
    >
      <div className="bg-background border rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Suggestions</span>
            {count > 0 && (
              <Badge variant="secondary" className="text-xs">
                {count}
              </Badge>
            )}
            {(isDismissing || isSnoozing || isActing) && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsMinimized(true)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ScrollArea className="max-h-[400px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No suggestions right now
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Check back later
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    <AnimatePresence mode="popLayout">
                      {suggestions.map((suggestion) => (
                        <SuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onDismiss={dismiss}
                          onSnooze={snooze}
                          onAct={act}
                          compact={suggestions.length > 3}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed preview */}
        {!isExpanded && count > 0 && (
          <div className="p-2">
            <SuggestionCard
              suggestion={suggestions[0]}
              onDismiss={dismiss}
              onAct={act}
              compact
            />
            {count > 1 && (
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
                onClick={() => setIsExpanded(true)}
              >
                +{count - 1} more suggestions
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
