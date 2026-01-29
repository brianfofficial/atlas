'use client'

import { Suspense } from 'react'
import { DailyBriefing, DailyBriefingSkeleton } from '@/components/briefings/daily-briefing'
import { useAuth } from '@/hooks/use-auth'

export default function BriefingsPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-6xl mx-auto">
      <Suspense fallback={<DailyBriefingSkeleton />}>
        <DailyBriefing userName={user?.username} />
      </Suspense>
    </div>
  )
}
