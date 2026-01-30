/**
 * Atlas API
 *
 * Central export for all API functions and types.
 */

// Core client
export { apiClient, apiGet, apiPost, apiPut, apiDelete, apiPatch, tokenManager, ApiError } from './client'

// Auth
export * from './auth'

// Preferences
export * from './preferences'

// Models
export * from './models'

// Memory
export * from './memory'

// Suggestions
export * from './suggestions'

// Approvals
export * from './approvals'

// Audit
export * from './audit'

// Dashboard
export * from './dashboard'

// Chat
export * from './chat'

// Briefings
export * from './briefings'

// Files
export * from './files'

// Integrations
export * from './weather'
export * from './calendar'
export {
  isGitHubConnected,
  getGitHubAuthUrl,
  disconnectGitHub,
  getCurrentUser as getGitHubUser,
  getRepositories,
  getPRsAwaitingReview,
  getMyOpenPRs,
  getRepositoryPRs,
  getPullRequest,
  getPRReviews,
  submitPRReview,
  getRepositoryIssues,
  getWorkflowRuns,
  getRecentCommits,
  getNotifications,
  markNotificationsRead,
  markNotificationRead,
  getGitHubSummary,
  getCIStatusColor,
  getReviewStatusColor,
  formatPRTitle,
  parseRepoFullName,
  type GitHubUser,
  type GitHubRepository,
  type GitHubPullRequest,
  type GitHubIssue,
  type GitHubCommit,
  type GitHubWorkflowRun,
  type GitHubNotification,
  type GitHubReview,
} from './github'

// Gmail and Slack have searchMessages which conflicts with chat
// Re-export with aliases
export { searchMessages as searchGmailMessages } from './gmail'
export { searchMessages as searchSlackMessages } from './slack'

// Re-export everything else from gmail (excluding searchMessages)
export {
  isGmailConnected,
  getGmailAuthUrl,
  disconnectGmail,
  getGmailProfile,
  getLabels as getGmailLabels,
  getInboxSummary,
  listMessages as listGmailMessages,
  getMessage as getGmailMessage,
  getThread as getGmailThread,
  markAsRead as markGmailAsRead,
  markAsUnread as markGmailAsUnread,
  starMessage,
  unstarMessage,
  archiveMessage,
  trashMessage,
  deleteMessage as deleteGmailMessage,
  addLabels,
  removeLabels,
  createDraft,
  updateDraft,
  sendDraft,
  sendEmail,
  getVIPSenders,
  setVIPSenders,
  GmailQueries,
  buildQuery,
  type GmailProfile,
  type GmailLabel,
  type GmailMessage,
  type GmailThread,
  type GmailDraft,
  type EmailComposition,
  type EmailAddress,
} from './gmail'

// Re-export everything else from slack (excluding searchMessages and getCurrentUser)
export {
  isSlackConnected,
  getSlackAuthUrl,
  disconnectSlack,
  getCurrentUser as getSlackCurrentUser,
  getWorkspaceInfo,
  getChannels as getSlackChannels,
  getDirectMessages as getSlackDMs,
  getMessages as getSlackMessages,
  getThread as getSlackThread,
  getUnreadMentions,
  getNotificationsSummary as getSlackNotificationsSummary,
  sendMessage as sendSlackMessage,
  sendDirectMessage as sendSlackDM,
  replyToThread as replyToSlackThread,
  addReaction as addSlackReaction,
  removeReaction as removeSlackReaction,
  markChannelRead,
  getUser as getSlackUser,
  getUsers as getSlackUsers,
  setStatus as setSlackStatus,
  clearStatus as clearSlackStatus,
  setPresence as setSlackPresence,
  parseMentions,
  formatMessageText,
  tsToDate,
  dateToTs,
  type SlackUser,
  type SlackChannel,
  type SlackMessage,
  type SlackThread,
  type SlackMention,
  type SlackNotification,
} from './slack'
