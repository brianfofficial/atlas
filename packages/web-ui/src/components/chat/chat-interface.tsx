'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Search,
  Download,
  MoreHorizontal,
  Trash2,
  Edit2,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatInput } from './chat-input'
import { MessageList } from './chat-message'
import { FileUploadZone } from './file-upload'
import type { Message, Conversation } from '@/lib/api/chat'
import type { UploadedFile } from '@/lib/api/files'

interface ChatInterfaceProps {
  conversation?: Conversation & { messages: Message[] }
  conversations?: Conversation[]
  onSendMessage: (content: string, attachments?: UploadedFile[]) => Promise<void>
  onNewConversation?: () => void
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (id: string) => void
  onRenameConversation?: (id: string, title: string) => void
  onOpenSearch?: () => void
  onOpenExport?: () => void
  isLoading?: boolean
  isSending?: boolean
  isStreaming?: boolean
  streamingContent?: string
  className?: string
}

export function ChatInterface({
  conversation,
  conversations = [],
  onSendMessage,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onOpenSearch,
  onOpenExport,
  isLoading,
  isSending,
  isStreaming,
  streamingContent,
  className,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showSidebar, setShowSidebar] = useState(true)

  // Auto-scroll to bottom when new messages arrive or streaming content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages.length, streamingContent])

  const handleSend = useCallback(
    async (content: string, attachments?: UploadedFile[]) => {
      await onSendMessage(content, attachments)
    },
    [onSendMessage]
  )

  return (
    <div className={cn('flex h-full', className)}>
      {/* Sidebar - Conversation List */}
      {showSidebar && (
        <div className="w-64 border-r flex flex-col bg-background-secondary">
          {/* Sidebar Header */}
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Conversations</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNewConversation}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={onNewConversation}
                    className="mt-1"
                  >
                    Start a new chat
                  </Button>
                </div>
              ) : (
                conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conversation?.id === conv.id}
                    onClick={() => onSelectConversation?.(conv.id)}
                    onDelete={() => onDeleteConversation?.(conv.id)}
                    onRename={(title) => onRenameConversation?.(conv.id, title)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="h-14 border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-semibold text-sm">
                {conversation?.title || 'New Conversation'}
              </h1>
              {conversation && (
                <p className="text-xs text-muted-foreground">
                  {conversation.messages.length} messages
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onOpenSearch}
              title="Search messages (Cmd+F)"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onOpenExport}
              title="Export conversation"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <FileUploadZone className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-3xl mx-auto p-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse flex gap-3 p-4 rounded-lg bg-muted/30"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                        <div className="h-4 w-3/4 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversation?.messages.length ? (
                <MessageList messages={conversation.messages} />
              ) : (
                <EmptyState onNewConversation={onNewConversation} />
              )}

              {/* Streaming response */}
              {isStreaming && streamingContent && (
                <div className="flex gap-3 p-4 mt-2">
                  <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                    <div className="h-4 w-4 rounded-full bg-success/30 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Atlas</span>
                      <span className="text-xs text-muted-foreground">generating...</span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{streamingContent}<span className="animate-pulse">▌</span></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Waiting indicator (before streaming starts) */}
              {isSending && !isStreaming && (
                <div className="flex gap-3 p-4 mt-2 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-success animate-bounce" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm text-muted-foreground">Atlas is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </FileUploadZone>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={handleSend}
              disabled={isSending}
              placeholder="Ask Atlas anything..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isActive?: boolean
  onClick: () => void
  onDelete: () => void
  onRename: (title: string) => void
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
  onDelete,
  onRename,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(conversation.title)

  const handleRename = () => {
    if (title.trim() && title !== conversation.title) {
      onRename(title.trim())
    }
    setIsEditing(false)
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
      )}
      onClick={onClick}
    >
      <MessageSquare className="h-4 w-4 shrink-0" />

      {isEditing ? (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename()
            if (e.key === 'Escape') {
              setTitle(conversation.title)
              setIsEditing(false)
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent border rounded px-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm truncate">{conversation.title}</span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-danger focus:text-danger"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function EmptyState({ onNewConversation }: { onNewConversation?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
      <p className="text-muted-foreground max-w-sm mb-6">
        Ask Atlas anything. Upload files, get code help, or just chat.
      </p>
      <div className="grid gap-2 text-sm text-left max-w-sm">
        <SuggestionChip>Help me write a Python script to process CSV files</SuggestionChip>
        <SuggestionChip>Explain how Kubernetes deployments work</SuggestionChip>
        <SuggestionChip>Review this code for security issues</SuggestionChip>
      </div>
    </div>
  )
}

function SuggestionChip({ children }: { children: React.ReactNode }) {
  return (
    <button className="p-3 rounded-lg border bg-background-secondary text-left hover:bg-muted transition-colors">
      {children}
    </button>
  )
}
