'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChatInterface } from '@/components/chat/chat-interface'
import { MessageSearch } from '@/components/chat/message-search'
import { ExportDialog } from '@/components/chat/export-dialog'
import {
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  updateConversation,
  sendMessage,
  type Conversation,
  type ConversationWithMessages,
} from '@/lib/api/chat'
import type { UploadedFile } from '@/lib/api/files'

export default function ChatPage() {
  const queryClient = useQueryClient()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fetch conversations list
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 30000,
  })

  // Fetch current conversation
  const { data: currentConversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', selectedConversationId],
    queryFn: () =>
      selectedConversationId ? getConversation(selectedConversationId) : null,
    enabled: !!selectedConversationId,
    staleTime: 10000,
  })

  // Create conversation mutation
  const createMutation = useMutation({
    mutationFn: (title?: string) => createConversation(title),
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setSelectedConversationId(newConversation.id)
    },
  })

  // Delete conversation mutation
  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (selectedConversationId) {
        setSelectedConversationId(null)
      }
    },
  })

  // Rename conversation mutation
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateConversation(id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] })
    },
  })

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({
      conversationId,
      content,
      attachments,
    }: {
      conversationId: string
      content: string
      attachments?: string[]
    }) => {
      return sendMessage(conversationId, { content, attachments })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string, uploadedFiles?: UploadedFile[]) => {
      let conversationId = selectedConversationId

      // Create a new conversation if needed
      if (!conversationId) {
        const newConversation = await createMutation.mutateAsync(
          content.slice(0, 50) // Use first part of message as title
        )
        conversationId = newConversation.id
      }

      // Send the message
      await sendMutation.mutateAsync({
        conversationId,
        content,
        attachments: uploadedFiles?.map((f) => f.id),
      })
    },
    [selectedConversationId, createMutation, sendMutation]
  )

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setSelectedConversationId(null)
  }, [])

  // Handle selecting a conversation
  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId(id)
  }, [])

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback(
    (id: string) => {
      deleteMutation.mutate(id)
    },
    [deleteMutation]
  )

  // Handle renaming a conversation
  const handleRenameConversation = useCallback(
    (id: string, title: string) => {
      renameMutation.mutate({ id, title })
    },
    [renameMutation]
  )

  // Handle jumping to a message from search
  const handleJumpToMessage = useCallback((messageId: string) => {
    // Find the message element and scroll to it
    const element = document.getElementById(`message-${messageId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('ring-2', 'ring-primary')
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary')
      }, 2000)
    }
    setIsSearchOpen(false)
  }, [])

  return (
    <div className="h-[calc(100vh-8rem)]">
      <ChatInterface
        conversation={currentConversation ?? undefined}
        conversations={conversations}
        onSendMessage={handleSendMessage}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        isLoading={conversationsLoading || conversationLoading}
        isSending={sendMutation.isPending}
      />

      {/* Search modal */}
      <MessageSearch
        messages={currentConversation?.messages || []}
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onJumpToMessage={handleJumpToMessage}
      />

      {/* Export dialog */}
      <ExportDialog
        conversation={currentConversation || null}
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
      />
    </div>
  )
}
