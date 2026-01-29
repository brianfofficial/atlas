'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FileUploadButton } from './file-upload'
import { FilePreviewList } from './file-preview'
import { useFileUpload } from '@/hooks/use-file-upload'
import type { UploadedFile } from '@/lib/api/files'

interface ChatInputProps {
  onSend: (content: string, attachments?: UploadedFile[]) => Promise<void>
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = 'Type a message...',
  className,
}: ChatInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    pendingFiles,
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    isDragging,
    dragHandlers,
    hasFiles,
    isUploading,
  } = useFileUpload()

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [content])

  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim()
    if (!trimmedContent && !hasFiles) return
    if (disabled || isSending) return

    setIsSending(true)
    try {
      // Upload any pending files first
      let uploadedFiles: UploadedFile[] = []
      if (hasFiles) {
        uploadedFiles = await uploadFiles()
      }

      // Send message
      await onSend(trimmedContent, uploadedFiles.length > 0 ? uploadedFiles : undefined)

      // Clear input
      setContent('')
      clearFiles()
    } finally {
      setIsSending(false)
    }
  }, [content, hasFiles, disabled, isSending, uploadFiles, onSend, clearFiles])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const files: File[] = []

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) {
      addFiles(files)
    }
  }

  const isDisabled = disabled || isSending || isUploading
  const canSend = (content.trim().length > 0 || hasFiles) && !isDisabled

  return (
    <div
      {...dragHandlers}
      className={cn(
        'relative border rounded-lg bg-background transition-colors',
        isDragging && 'border-primary ring-2 ring-primary/20',
        className
      )}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-primary/5 rounded-lg flex items-center justify-center">
          <span className="text-sm font-medium text-primary">Drop files here</span>
        </div>
      )}

      {/* File previews */}
      {hasFiles && (
        <div className="border-b px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} attached
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={clearFiles}
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          </div>
          <FilePreviewList files={pendingFiles} onRemove={removeFile} size="sm" />
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-2">
        <FileUploadButton
          onFilesSelected={(files) => addFiles(files)}
          disabled={isDisabled}
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent border-0 focus:ring-0 focus:outline-none text-sm py-2',
            'placeholder:text-muted-foreground min-h-[40px] max-h-[200px]',
            isDisabled && 'opacity-50 cursor-not-allowed'
          )}
        />

        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className="shrink-0"
        >
          {isSending || isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Character count (optional, shows when near limit) */}
      {content.length > 3500 && (
        <div className="absolute bottom-1 right-16 text-xs text-muted-foreground">
          {content.length} / 4000
        </div>
      )}
    </div>
  )
}
