'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as weatherApi from '@/lib/api/weather'
import * as gmailApi from '@/lib/api/gmail'
import * as calendarApi from '@/lib/api/calendar'
import * as slackApi from '@/lib/api/slack'
import * as githubApi from '@/lib/api/github'

/**
 * Weather integration hook
 */
export function useWeatherIntegration(location?: string) {
  return useQuery({
    queryKey: ['weather', location],
    queryFn: async () => {
      if (location) {
        return weatherApi.getWeatherByCity(location)
      }
      return weatherApi.getWeatherForCurrentLocation()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  })
}

/**
 * Gmail connection status hook
 */
export function useGmailConnection() {
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['gmail', 'status'],
    queryFn: gmailApi.isGmailConnected,
    staleTime: 5 * 60 * 1000,
  })

  const disconnectMutation = useMutation({
    mutationFn: gmailApi.disconnectGmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail'] })
    },
  })

  return {
    isConnected: statusQuery.data ?? false,
    isLoading: statusQuery.isLoading,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  }
}

/**
 * Gmail inbox summary hook
 */
export function useGmailInbox() {
  return useQuery({
    queryKey: ['gmail', 'inbox'],
    queryFn: gmailApi.getInboxSummary,
    staleTime: 60 * 1000, // 1 minute
    enabled: true, // Should check connection first in real app
  })
}

/**
 * Calendar connection status hook
 */
export function useCalendarConnection() {
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['calendar', 'status'],
    queryFn: calendarApi.isCalendarConnected,
    staleTime: 5 * 60 * 1000,
  })

  const disconnectMutation = useMutation({
    mutationFn: calendarApi.disconnectCalendar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })

  return {
    isConnected: statusQuery.data ?? false,
    isLoading: statusQuery.isLoading,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  }
}

/**
 * Calendar events hook
 */
export function useCalendarEvents(range?: { start: Date; end: Date }) {
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  return useQuery({
    queryKey: ['calendar', 'events', range?.start.toISOString(), range?.end.toISOString()],
    queryFn: () =>
      calendarApi.getEvents(range?.start || startOfDay, range?.end || endOfDay, {
        singleEvents: true,
      }),
    staleTime: 60 * 1000,
  })
}

/**
 * Today's calendar events hook
 */
export function useTodayEvents() {
  return useQuery({
    queryKey: ['calendar', 'today'],
    queryFn: calendarApi.getTodayEvents,
    staleTime: 60 * 1000,
  })
}

/**
 * Slack connection status hook
 */
export function useSlackConnection() {
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['slack', 'status'],
    queryFn: slackApi.isSlackConnected,
    staleTime: 5 * 60 * 1000,
  })

  const disconnectMutation = useMutation({
    mutationFn: slackApi.disconnectSlack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack'] })
    },
  })

  return {
    isConnected: statusQuery.data ?? false,
    isLoading: statusQuery.isLoading,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  }
}

/**
 * Slack notifications hook
 */
export function useSlackNotifications() {
  return useQuery({
    queryKey: ['slack', 'notifications'],
    queryFn: slackApi.getNotificationsSummary,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Send Slack message hook
 */
export function useSendSlackMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      channelId,
      text,
      threadTs,
    }: {
      channelId: string
      text: string
      threadTs?: string
    }) => slackApi.sendMessage(channelId, text, { threadTs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack'] })
    },
  })
}

/**
 * GitHub connection status hook
 */
export function useGitHubConnection() {
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['github', 'status'],
    queryFn: githubApi.isGitHubConnected,
    staleTime: 5 * 60 * 1000,
  })

  const disconnectMutation = useMutation({
    mutationFn: githubApi.disconnectGitHub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github'] })
    },
  })

  return {
    isConnected: statusQuery.data ?? false,
    isLoading: statusQuery.isLoading,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  }
}

/**
 * GitHub summary hook
 */
export function useGitHubSummary() {
  return useQuery({
    queryKey: ['github', 'summary'],
    queryFn: githubApi.getGitHubSummary,
    staleTime: 60 * 1000,
  })
}

/**
 * PRs awaiting review hook
 */
export function usePRsAwaitingReview() {
  return useQuery({
    queryKey: ['github', 'prs', 'review-requested'],
    queryFn: githubApi.getPRsAwaitingReview,
    staleTime: 60 * 1000,
  })
}

/**
 * My open PRs hook
 */
export function useMyOpenPRs() {
  return useQuery({
    queryKey: ['github', 'prs', 'mine'],
    queryFn: githubApi.getMyOpenPRs,
    staleTime: 60 * 1000,
  })
}

/**
 * Submit PR review hook
 */
export function useSubmitPRReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      owner,
      repo,
      prNumber,
      event,
      body,
    }: {
      owner: string
      repo: string
      prNumber: number
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
      body?: string
    }) => githubApi.submitPRReview(owner, repo, prNumber, { event, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github', 'prs'] })
    },
  })
}

/**
 * Combined integration status hook
 * Returns connection status for all integrations
 */
export function useIntegrationStatus() {
  const gmail = useGmailConnection()
  const calendar = useCalendarConnection()
  const slack = useSlackConnection()
  const github = useGitHubConnection()

  return {
    gmail,
    calendar,
    slack,
    github,
    allConnected: gmail.isConnected && calendar.isConnected && slack.isConnected && github.isConnected,
    isLoading: gmail.isLoading || calendar.isLoading || slack.isLoading || github.isLoading,
  }
}
