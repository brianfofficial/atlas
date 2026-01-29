'use client'

import { Suspense } from 'react'
import { Sun, Moon, Sunrise, Coffee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WeatherWidget, useWeather } from './weather-widget'
import { CalendarWidget, useCalendar } from './calendar-widget'
import { EmailSummary, useEmailSummary } from './email-summary'
import { GitHubWidget, useGitHub } from './github-widget'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface DailyBriefingProps {
  className?: string
  userName?: string
}

export function DailyBriefing({ className, userName }: DailyBriefingProps) {
  const greeting = getGreeting()
  const { data: weatherData, isLoading: weatherLoading, refresh: refreshWeather } = useWeather()
  const { events, isLoading: calendarLoading, refresh: refreshCalendar } = useCalendar()
  const { data: emailData, isLoading: emailLoading, refresh: refreshEmail } = useEmailSummary()
  const { data: githubData, isLoading: githubLoading, refresh: refreshGitHub } = useGitHub()

  return (
    <div className={cn('space-y-6', className)}>
      {/* Greeting header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <greeting.icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {greeting.text}
            {userName && `, ${userName}`}
          </h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Quick summary */}
      <QuickSummary
        events={events}
        emailData={emailData}
        githubData={githubData}
        isLoading={calendarLoading || emailLoading || githubLoading}
      />

      {/* Widgets grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WeatherWidget
          data={weatherData ?? undefined}
          isLoading={weatherLoading}
          onRefresh={refreshWeather}
          className="md:col-span-1"
        />

        <CalendarWidget
          events={events}
          isLoading={calendarLoading}
          onRefresh={refreshCalendar}
          className="md:col-span-1 lg:col-span-2"
        />

        <EmailSummary
          data={emailData ?? undefined}
          isLoading={emailLoading}
          onRefresh={refreshEmail}
          className="md:col-span-1"
        />

        <GitHubWidget
          data={githubData ?? undefined}
          isLoading={githubLoading}
          onRefresh={refreshGitHub}
          className="md:col-span-1 lg:col-span-2"
        />
      </div>
    </div>
  )
}

interface QuickSummaryProps {
  events?: Array<{ startTime: Date; title: string }>
  emailData?: { unreadCount: number } | null
  githubData?: { prsAwaitingReview: unknown[]; myOpenPRs: unknown[] } | null
  isLoading?: boolean
}

function QuickSummary({ events, emailData, githubData, isLoading }: QuickSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const now = new Date()
  const nextEvent = events?.find((e) => e.startTime > now)
  const todayEventCount = events?.filter(
    (e) =>
      e.startTime.getDate() === now.getDate() &&
      e.startTime.getMonth() === now.getMonth() &&
      e.startTime.getFullYear() === now.getFullYear()
  ).length

  const summaryItems: Array<{ label: string; value: string | number; highlight?: boolean }> = []

  if (todayEventCount !== undefined) {
    summaryItems.push({
      label: 'meetings today',
      value: todayEventCount,
    })
  }

  if (nextEvent) {
    const minutes = Math.round((nextEvent.startTime.getTime() - now.getTime()) / 60000)
    if (minutes > 0 && minutes < 120) {
      summaryItems.push({
        label: `until ${nextEvent.title}`,
        value: `${minutes}m`,
        highlight: minutes < 15,
      })
    }
  }

  if (emailData?.unreadCount) {
    summaryItems.push({
      label: 'unread emails',
      value: emailData.unreadCount,
      highlight: emailData.unreadCount > 10,
    })
  }

  if (githubData?.prsAwaitingReview.length) {
    summaryItems.push({
      label: 'PRs to review',
      value: githubData.prsAwaitingReview.length,
      highlight: true,
    })
  }

  if (summaryItems.length === 0) {
    return null
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {summaryItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span
                className={cn('text-xl font-bold', item.highlight && 'text-primary')}
              >
                {item.value}
              </span>
              <span className="text-muted-foreground text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getGreeting(): { text: string; icon: typeof Sun } {
  const hour = new Date().getHours()

  if (hour < 5) {
    return { text: 'Good night', icon: Moon }
  } else if (hour < 12) {
    return { text: 'Good morning', icon: hour < 9 ? Sunrise : Coffee }
  } else if (hour < 17) {
    return { text: 'Good afternoon', icon: Sun }
  } else if (hour < 21) {
    return { text: 'Good evening', icon: Sun }
  } else {
    return { text: 'Good night', icon: Moon }
  }
}

// Loading skeleton for the entire briefing
export function DailyBriefingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      <Skeleton className="h-16 rounded-lg" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg lg:col-span-2" />
      </div>
    </div>
  )
}
