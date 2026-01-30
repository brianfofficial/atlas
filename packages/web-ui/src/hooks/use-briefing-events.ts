'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from './use-websocket'
import type {
  Briefing,
  DraftItem,
  MetricsDashboard,
  TrustSignal,
} from '@/lib/api/briefings'

// ============================================================================
// Types
// ============================================================================

export interface BriefingGeneratedEvent {
  briefingId: string
  type: 'daily' | 'weekly'
  timestamp: string
}

export interface BriefingViewedEvent {
  briefingId: string
  userId: string
  timestamp: string
}

export interface BriefingCompletedEvent {
  briefingId: string
  stats: {
    totalItems: number
    approvedItems: number
    dismissedItems: number
    editedItems: number
  }
  timestamp: string
}

export interface DraftApprovedEvent {
  itemId: string
  briefingId: string
  undoDeadline: string
  timestamp: string
}

export interface DraftDismissedEvent {
  itemId: string
  briefingId: string
  reason?: string
  timestamp: string
}

export interface DraftEditedEvent {
  itemId: string
  briefingId: string
  undoDeadline: string
  timestamp: string
}

export interface DraftExecutedEvent {
  itemId: string
  briefingId: string
  surface: 'email' | 'calendar' | 'tasks'
  timestamp: string
}

export interface DraftUndoneEvent {
  itemId: string
  briefingId: string
  timestamp: string
}

export interface MetricsUpdatedEvent {
  metrics: Partial<MetricsDashboard['metrics']>
  timestamp: string
}

export interface TrustFailureEvent {
  signal: TrustSignal
  severity: 'warning' | 'stop'
  description: string
  timestamp: string
}

export interface ScheduleTriggeredEvent {
  type: 'daily' | 'weekly'
  briefingId: string
  timestamp: string
}

// ============================================================================
// Briefing Events Hook
// ============================================================================

export interface UseBriefingEventsHandlers {
  onBriefingGenerated?: (event: BriefingGeneratedEvent) => void
  onBriefingViewed?: (event: BriefingViewedEvent) => void
  onBriefingCompleted?: (event: BriefingCompletedEvent) => void
  onDraftApproved?: (event: DraftApprovedEvent) => void
  onDraftDismissed?: (event: DraftDismissedEvent) => void
  onDraftEdited?: (event: DraftEditedEvent) => void
  onDraftExecuted?: (event: DraftExecutedEvent) => void
  onDraftUndone?: (event: DraftUndoneEvent) => void
  onScheduleTriggered?: (event: ScheduleTriggeredEvent) => void
}

/**
 * Hook for subscribing to briefing and draft lifecycle events
 *
 * @example
 * ```tsx
 * function BriefingDashboard() {
 *   const [briefing, setBriefing] = useState<Briefing | null>(null)
 *
 *   useBriefingEvents({
 *     onBriefingGenerated: (event) => {
 *       // Refresh briefing data
 *       refetchBriefing()
 *     },
 *     onDraftApproved: (event) => {
 *       // Update local state
 *       updateDraftStatus(event.itemId, 'approved')
 *     },
 *     onDraftUndone: (event) => {
 *       // Revert draft status
 *       updateDraftStatus(event.itemId, 'pending')
 *     },
 *   })
 *
 *   return <BriefingContent briefing={briefing} />
 * }
 * ```
 */
export function useBriefingEvents(handlers: UseBriefingEventsHandlers) {
  const { onMessage, isConnected } = useWebSocket()
  const handlersRef = useRef(handlers)

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!isConnected) return

    const unsubs: (() => void)[] = []

    // Briefing lifecycle events
    unsubs.push(
      onMessage('briefing:generated', (msg) => {
        handlersRef.current.onBriefingGenerated?.(msg.payload as BriefingGeneratedEvent)
      })
    )

    unsubs.push(
      onMessage('briefing:viewed', (msg) => {
        handlersRef.current.onBriefingViewed?.(msg.payload as BriefingViewedEvent)
      })
    )

    unsubs.push(
      onMessage('briefing:completed', (msg) => {
        handlersRef.current.onBriefingCompleted?.(msg.payload as BriefingCompletedEvent)
      })
    )

    // Draft action events
    unsubs.push(
      onMessage('draft:approved', (msg) => {
        handlersRef.current.onDraftApproved?.(msg.payload as DraftApprovedEvent)
      })
    )

    unsubs.push(
      onMessage('draft:dismissed', (msg) => {
        handlersRef.current.onDraftDismissed?.(msg.payload as DraftDismissedEvent)
      })
    )

    unsubs.push(
      onMessage('draft:edited', (msg) => {
        handlersRef.current.onDraftEdited?.(msg.payload as DraftEditedEvent)
      })
    )

    unsubs.push(
      onMessage('draft:executed', (msg) => {
        handlersRef.current.onDraftExecuted?.(msg.payload as DraftExecutedEvent)
      })
    )

    unsubs.push(
      onMessage('draft:undone', (msg) => {
        handlersRef.current.onDraftUndone?.(msg.payload as DraftUndoneEvent)
      })
    )

    // Schedule events
    unsubs.push(
      onMessage('schedule:triggered', (msg) => {
        handlersRef.current.onScheduleTriggered?.(msg.payload as ScheduleTriggeredEvent)
      })
    )

    return () => {
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }, [isConnected, onMessage])
}

// ============================================================================
// Metrics Updates Hook
// ============================================================================

export interface UseMetricsUpdatesHandlers {
  onMetricsUpdated?: (event: MetricsUpdatedEvent) => void
  onTrustFailure?: (event: TrustFailureEvent) => void
}

/**
 * Hook for subscribing to metrics and trust health updates
 *
 * @example
 * ```tsx
 * function MetricsDashboard() {
 *   const [metrics, setMetrics] = useState<MetricsDashboard | null>(null)
 *
 *   useMetricsUpdates({
 *     onMetricsUpdated: (event) => {
 *       // Merge updated metrics
 *       setMetrics(prev => ({
 *         ...prev,
 *         metrics: { ...prev?.metrics, ...event.metrics }
 *       }))
 *     },
 *     onTrustFailure: (event) => {
 *       // Show alert
 *       showTrustAlert(event)
 *     },
 *   })
 *
 *   return <MetricsContent metrics={metrics} />
 * }
 * ```
 */
export function useMetricsUpdates(handlers: UseMetricsUpdatesHandlers) {
  const { onMessage, isConnected } = useWebSocket()
  const handlersRef = useRef(handlers)

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!isConnected) return

    const unsubs: (() => void)[] = []

    unsubs.push(
      onMessage('metrics:updated', (msg) => {
        handlersRef.current.onMetricsUpdated?.(msg.payload as MetricsUpdatedEvent)
      })
    )

    unsubs.push(
      onMessage('trust:failure', (msg) => {
        handlersRef.current.onTrustFailure?.(msg.payload as TrustFailureEvent)
      })
    )

    return () => {
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }, [isConnected, onMessage])
}

// ============================================================================
// Combined Hook with State Management
// ============================================================================

export interface UseBriefingRealtimeOptions {
  onNewBriefing?: () => void
  onDraftStatusChange?: (itemId: string, status: 'approved' | 'dismissed' | 'edited' | 'pending') => void
  onTrustAlert?: (event: TrustFailureEvent) => void
}

/**
 * Combined hook that manages briefing state with real-time updates
 *
 * @example
 * ```tsx
 * function BriefingPage() {
 *   const {
 *     hasPendingNotification,
 *     clearNotification,
 *     trustAlerts
 *   } = useBriefingRealtime({
 *     onNewBriefing: () => refetch(),
 *     onDraftStatusChange: (id, status) => updateCache(id, status),
 *   })
 *
 *   return (
 *     <>
 *       {hasPendingNotification && (
 *         <Banner onClick={clearNotification}>New briefing available!</Banner>
 *       )}
 *       {trustAlerts.length > 0 && <TrustAlerts alerts={trustAlerts} />}
 *     </>
 *   )
 * }
 * ```
 */
export function useBriefingRealtime(options: UseBriefingRealtimeOptions = {}) {
  const [hasPendingNotification, setHasPendingNotification] = useState(false)
  const [trustAlerts, setTrustAlerts] = useState<TrustFailureEvent[]>([])
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useBriefingEvents({
    onBriefingGenerated: useCallback((event) => {
      setHasPendingNotification(true)
      setLastEvent(`briefing:generated:${event.briefingId}`)
      optionsRef.current.onNewBriefing?.()
    }, []),

    onDraftApproved: useCallback((event) => {
      setLastEvent(`draft:approved:${event.itemId}`)
      optionsRef.current.onDraftStatusChange?.(event.itemId, 'approved')
    }, []),

    onDraftDismissed: useCallback((event) => {
      setLastEvent(`draft:dismissed:${event.itemId}`)
      optionsRef.current.onDraftStatusChange?.(event.itemId, 'dismissed')
    }, []),

    onDraftEdited: useCallback((event) => {
      setLastEvent(`draft:edited:${event.itemId}`)
      optionsRef.current.onDraftStatusChange?.(event.itemId, 'edited')
    }, []),

    onDraftUndone: useCallback((event) => {
      setLastEvent(`draft:undone:${event.itemId}`)
      optionsRef.current.onDraftStatusChange?.(event.itemId, 'pending')
    }, []),
  })

  useMetricsUpdates({
    onTrustFailure: useCallback((event) => {
      setTrustAlerts((prev) => [...prev, event])
      setLastEvent(`trust:failure:${event.signal.type}`)
      optionsRef.current.onTrustAlert?.(event)
    }, []),
  })

  const clearNotification = useCallback(() => {
    setHasPendingNotification(false)
  }, [])

  const dismissTrustAlert = useCallback((index: number) => {
    setTrustAlerts((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearTrustAlerts = useCallback(() => {
    setTrustAlerts([])
  }, [])

  return {
    hasPendingNotification,
    clearNotification,
    trustAlerts,
    dismissTrustAlert,
    clearTrustAlerts,
    lastEvent,
  }
}

// ============================================================================
// Notification Integration Hook
// ============================================================================

import type { Notification, NotificationType } from '@/components/notifications/notification-center'

/**
 * Hook to convert briefing events into notifications
 *
 * @example
 * ```tsx
 * function App() {
 *   const { notifications, addNotification } = useNotifications()
 *   useBriefingNotifications(addNotification)
 *
 *   return <NotificationCenter notifications={notifications} ... />
 * }
 * ```
 */
export function useBriefingNotifications(
  addNotification: (notification: Notification) => void
) {
  useBriefingEvents({
    onBriefingGenerated: useCallback((event) => {
      addNotification({
        id: `briefing-${event.briefingId}`,
        type: 'briefing_ready',
        title: 'Daily Briefing Ready',
        message: `Your ${event.type} briefing is ready for review.`,
        priority: 'medium',
        read: false,
        actionUrl: '/briefings',
        actionLabel: 'View Briefing',
        createdAt: event.timestamp,
      })
    }, [addNotification]),

    onDraftExecuted: useCallback((event) => {
      addNotification({
        id: `draft-executed-${event.itemId}`,
        type: 'draft_executed',
        title: 'Action Executed',
        message: `Your ${event.surface} action has been executed.`,
        priority: 'low',
        read: false,
        createdAt: event.timestamp,
      })
    }, [addNotification]),
  })

  useMetricsUpdates({
    onTrustFailure: useCallback((event) => {
      addNotification({
        id: `trust-${Date.now()}`,
        type: 'security_alert',
        title: 'Trust Signal Alert',
        message: event.description,
        priority: event.severity === 'stop' ? 'urgent' : 'high',
        read: false,
        createdAt: event.timestamp,
      })
    }, [addNotification]),
  })
}
