/**
 * GitHub API Client
 *
 * Integration with GitHub REST and GraphQL APIs.
 * Supports personal access tokens and GitHub Apps.
 */

import { apiGet, apiPost, apiPut, apiDelete } from './client'

export interface GitHubUser {
  id: number
  login: string
  name?: string
  email?: string
  avatarUrl: string
  htmlUrl: string
  type: 'User' | 'Organization'
}

export interface GitHubRepository {
  id: number
  name: string
  fullName: string
  private: boolean
  description?: string
  htmlUrl: string
  defaultBranch: string
  language?: string
  stargazersCount: number
  forksCount: number
  openIssuesCount: number
  updatedAt: Date
  pushedAt: Date
  owner: GitHubUser
}

export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  body?: string
  state: 'open' | 'closed'
  draft: boolean
  merged: boolean
  mergedAt?: Date
  htmlUrl: string
  user: GitHubUser
  base: {
    ref: string
    sha: string
  }
  head: {
    ref: string
    sha: string
  }
  labels: Array<{
    name: string
    color: string
  }>
  assignees: GitHubUser[]
  requestedReviewers: GitHubUser[]
  reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED'
  additions: number
  deletions: number
  changedFiles: number
  commits: number
  comments: number
  createdAt: Date
  updatedAt: Date
}

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body?: string
  state: 'open' | 'closed'
  htmlUrl: string
  user: GitHubUser
  labels: Array<{
    name: string
    color: string
  }>
  assignees: GitHubUser[]
  milestone?: {
    title: string
    dueOn?: Date
  }
  comments: number
  createdAt: Date
  updatedAt: Date
  closedAt?: Date
}

export interface GitHubCommit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: Date
  }
  htmlUrl: string
  stats?: {
    additions: number
    deletions: number
    total: number
  }
}

export interface GitHubWorkflowRun {
  id: number
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required'
  htmlUrl: string
  headBranch: string
  headSha: string
  event: string
  createdAt: Date
  updatedAt: Date
}

export interface GitHubNotification {
  id: string
  repository: GitHubRepository
  subject: {
    title: string
    url?: string
    type: 'Issue' | 'PullRequest' | 'Commit' | 'Release' | 'Discussion'
  }
  reason: string
  unread: boolean
  updatedAt: Date
}

export interface GitHubReview {
  id: number
  user: GitHubUser
  body?: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED'
  submittedAt: Date
}

/**
 * Check if GitHub is connected
 */
export async function isGitHubConnected(): Promise<boolean> {
  try {
    const result = await apiGet<{ connected: boolean }>('/api/integrations/github/status')
    return result.connected
  } catch {
    return false
  }
}

/**
 * Get GitHub OAuth URL
 */
export async function getGitHubAuthUrl(): Promise<string> {
  const result = await apiGet<{ url: string }>('/api/integrations/github/auth-url')
  return result.url
}

/**
 * Disconnect GitHub
 */
export async function disconnectGitHub(): Promise<void> {
  return apiDelete('/api/integrations/github/disconnect')
}

/**
 * Get authenticated user
 */
export async function getCurrentUser(): Promise<GitHubUser> {
  return apiGet<GitHubUser>('/api/integrations/github/user')
}

/**
 * Get user's repositories
 */
export async function getRepositories(options?: {
  type?: 'all' | 'owner' | 'public' | 'private' | 'member'
  sort?: 'created' | 'updated' | 'pushed' | 'full_name'
  direction?: 'asc' | 'desc'
  perPage?: number
}): Promise<GitHubRepository[]> {
  const params = new URLSearchParams()
  if (options?.type) params.set('type', options.type)
  if (options?.sort) params.set('sort', options.sort)
  if (options?.direction) params.set('direction', options.direction)
  if (options?.perPage) params.set('per_page', options.perPage.toString())

  return apiGet<GitHubRepository[]>(`/api/integrations/github/repos?${params}`)
}

/**
 * Get PRs awaiting review
 */
export async function getPRsAwaitingReview(): Promise<GitHubPullRequest[]> {
  return apiGet<GitHubPullRequest[]>('/api/integrations/github/prs/review-requested')
}

/**
 * Get user's open PRs
 */
export async function getMyOpenPRs(): Promise<GitHubPullRequest[]> {
  return apiGet<GitHubPullRequest[]>('/api/integrations/github/prs/mine')
}

/**
 * Get pull requests for a repository
 */
export async function getRepositoryPRs(
  owner: string,
  repo: string,
  options?: {
    state?: 'open' | 'closed' | 'all'
    sort?: 'created' | 'updated' | 'popularity' | 'long-running'
    direction?: 'asc' | 'desc'
    perPage?: number
  }
): Promise<GitHubPullRequest[]> {
  const params = new URLSearchParams()
  if (options?.state) params.set('state', options.state)
  if (options?.sort) params.set('sort', options.sort)
  if (options?.direction) params.set('direction', options.direction)
  if (options?.perPage) params.set('per_page', options.perPage.toString())

  return apiGet<GitHubPullRequest[]>(
    `/api/integrations/github/repos/${owner}/${repo}/pulls?${params}`
  )
}

/**
 * Get a single pull request
 */
export async function getPullRequest(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubPullRequest> {
  return apiGet<GitHubPullRequest>(
    `/api/integrations/github/repos/${owner}/${repo}/pulls/${prNumber}`
  )
}

/**
 * Get PR reviews
 */
export async function getPRReviews(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubReview[]> {
  return apiGet<GitHubReview[]>(
    `/api/integrations/github/repos/${owner}/${repo}/pulls/${prNumber}/reviews`
  )
}

/**
 * Submit a PR review
 */
export async function submitPRReview(
  owner: string,
  repo: string,
  prNumber: number,
  review: {
    body?: string
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  }
): Promise<GitHubReview> {
  return apiPost<GitHubReview>(
    `/api/integrations/github/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    review
  )
}

/**
 * Get issues for a repository
 */
export async function getRepositoryIssues(
  owner: string,
  repo: string,
  options?: {
    state?: 'open' | 'closed' | 'all'
    labels?: string[]
    assignee?: string
    sort?: 'created' | 'updated' | 'comments'
    direction?: 'asc' | 'desc'
    perPage?: number
  }
): Promise<GitHubIssue[]> {
  const params = new URLSearchParams()
  if (options?.state) params.set('state', options.state)
  if (options?.labels) params.set('labels', options.labels.join(','))
  if (options?.assignee) params.set('assignee', options.assignee)
  if (options?.sort) params.set('sort', options.sort)
  if (options?.direction) params.set('direction', options.direction)
  if (options?.perPage) params.set('per_page', options.perPage.toString())

  return apiGet<GitHubIssue[]>(
    `/api/integrations/github/repos/${owner}/${repo}/issues?${params}`
  )
}

/**
 * Get workflow runs for a repository
 */
export async function getWorkflowRuns(
  owner: string,
  repo: string,
  options?: {
    branch?: string
    status?: 'queued' | 'in_progress' | 'completed'
    perPage?: number
  }
): Promise<GitHubWorkflowRun[]> {
  const params = new URLSearchParams()
  if (options?.branch) params.set('branch', options.branch)
  if (options?.status) params.set('status', options.status)
  if (options?.perPage) params.set('per_page', options.perPage.toString())

  return apiGet<GitHubWorkflowRun[]>(
    `/api/integrations/github/repos/${owner}/${repo}/actions/runs?${params}`
  )
}

/**
 * Get recent commits for a repository
 */
export async function getRecentCommits(
  owner: string,
  repo: string,
  options?: {
    sha?: string
    since?: Date
    until?: Date
    perPage?: number
  }
): Promise<GitHubCommit[]> {
  const params = new URLSearchParams()
  if (options?.sha) params.set('sha', options.sha)
  if (options?.since) params.set('since', options.since.toISOString())
  if (options?.until) params.set('until', options.until.toISOString())
  if (options?.perPage) params.set('per_page', options.perPage.toString())

  return apiGet<GitHubCommit[]>(
    `/api/integrations/github/repos/${owner}/${repo}/commits?${params}`
  )
}

/**
 * Get notifications
 */
export async function getNotifications(options?: {
  all?: boolean
  participating?: boolean
  since?: Date
  before?: Date
  perPage?: number
}): Promise<GitHubNotification[]> {
  const params = new URLSearchParams()
  if (options?.all) params.set('all', 'true')
  if (options?.participating) params.set('participating', 'true')
  if (options?.since) params.set('since', options.since.toISOString())
  if (options?.before) params.set('before', options.before.toISOString())
  if (options?.perPage) params.set('per_page', options.perPage.toString())

  return apiGet<GitHubNotification[]>(`/api/integrations/github/notifications?${params}`)
}

/**
 * Mark notifications as read
 */
export async function markNotificationsRead(lastReadAt?: Date): Promise<void> {
  return apiPut('/api/integrations/github/notifications', {
    last_read_at: lastReadAt?.toISOString(),
  })
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(threadId: string): Promise<void> {
  return apiPost(`/api/integrations/github/notifications/threads/${threadId}`)
}

/**
 * Get GitHub status summary
 */
export async function getGitHubSummary(): Promise<{
  prsAwaitingReview: GitHubPullRequest[]
  myOpenPRs: GitHubPullRequest[]
  recentCommitsToday: number
  unreadNotifications: number
  failingWorkflows: GitHubWorkflowRun[]
}> {
  return apiGet('/api/integrations/github/summary')
}

// Utility functions

/**
 * Get CI status color class
 */
export function getCIStatusColor(conclusion?: string): string {
  switch (conclusion) {
    case 'success':
      return 'text-success'
    case 'failure':
      return 'text-danger'
    case 'cancelled':
    case 'skipped':
      return 'text-muted-foreground'
    case 'timed_out':
    case 'action_required':
      return 'text-warning'
    default:
      return 'text-warning' // pending/in_progress
  }
}

/**
 * Get review status color class
 */
export function getReviewStatusColor(decision?: string): string {
  switch (decision) {
    case 'APPROVED':
      return 'text-success'
    case 'CHANGES_REQUESTED':
      return 'text-danger'
    case 'REVIEW_REQUIRED':
    default:
      return 'text-warning'
  }
}

/**
 * Format PR title for display
 */
export function formatPRTitle(title: string, maxLength = 60): string {
  if (title.length <= maxLength) return title
  return title.slice(0, maxLength - 3) + '...'
}

/**
 * Parse repository full name
 */
export function parseRepoFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/')
  return { owner, repo }
}
