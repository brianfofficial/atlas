'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  History,
  Check,
  X,
  Clock,
  Zap,
  Filter,
  ChevronLeft,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { useApprovalHistory, ApprovalAuditEntry } from '@/hooks/use-approvals'

type FilterAction = 'all' | 'approved' | 'denied' | 'auto_approved' | 'expired'

const actionIcons: Record<string, typeof Check> = {
  approved: Check,
  denied: X,
  auto_approved: Zap,
  expired: Clock,
  created: Clock,
}

const actionLabels: Record<string, string> = {
  approved: 'Approved',
  denied: 'Denied',
  auto_approved: 'Auto-approved',
  expired: 'Expired',
  created: 'Created',
}

const actionColors: Record<string, string> = {
  approved: 'text-success',
  denied: 'text-danger',
  auto_approved: 'text-primary',
  expired: 'text-muted-foreground',
  created: 'text-muted-foreground',
}

export default function ApprovalHistoryPage() {
  const { history, isLoading } = useApprovalHistory()
  const [filter, setFilter] = useState<FilterAction>('all')
  const [search, setSearch] = useState('')

  const filteredHistory = history
    .filter((entry) => {
      if (filter !== 'all' && entry.action !== filter) return false
      if (search && !entry.requestId.includes(search)) return false
      return true
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/approvals">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Approval History</h1>
          <p className="text-muted-foreground">
            Complete audit trail of all approval decisions
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by request ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterAction)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="auto_approved">Auto-approved</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* History list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-background-secondary rounded animate-pulse"
                />
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search || filter !== 'all'
                ? 'No matching entries found.'
                : 'No approval history yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((entry, index) => (
                <HistoryEntry key={entry.id} entry={entry} index={index} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HistoryEntry({
  entry,
  index,
}: {
  entry: ApprovalAuditEntry
  index: number
}) {
  const Icon = actionIcons[entry.action] ?? Clock
  const label = actionLabels[entry.action] ?? entry.action
  const colorClass = actionColors[entry.action] ?? 'text-muted-foreground'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="flex items-center gap-4 p-4 rounded-lg hover:bg-background-secondary transition-colors"
    >
      <div className={`w-8 h-8 rounded-full bg-background-tertiary flex items-center justify-center ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <Badge variant="secondary" className="text-xs font-mono">
            {entry.requestId.slice(0, 8)}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <span>{formatRelativeTime(new Date(entry.timestamp))}</span>
          {entry.userId && (
            <>
              <span>•</span>
              <span>by {entry.userId}</span>
            </>
          )}
          {entry.details && 'ruleName' in entry.details && (
            <>
              <span>•</span>
              <span>Rule: {String(entry.details.ruleName)}</span>
            </>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {formatDate(new Date(entry.timestamp))}
      </div>
    </motion.div>
  )
}
