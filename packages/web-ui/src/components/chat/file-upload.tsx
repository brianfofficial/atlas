'use client'

import { useRef } from 'react'
import { Upload, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FilePreviewList } from './file-preview'
import { useFileUpload, type PendingFile } from '@/hooks/use-file-upload'
import { MAX_FILE_SIZE } from '@/lib/api/files'

interface FileUploadZoneProps {
  children: React.ReactNode
  onFilesAdded?: (files: PendingFile[]) => void
  className?: string
  disabled?: boolean
}

export function FileUploadZone({
  children,
  onFilesAdded,
  className,
  disabled,
}: FileUploadZoneProps) {
  const { isDragging, dragHandlers, addFiles, pendingFiles } = useFileUpload({
    onUploadComplete: () => {
      onFilesAdded?.(pendingFiles)
    },
  })

  return (
    <div
      {...(disabled ? {} : dragHandlers)}
      className={cn('relative', className)}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && !disabled && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-10 w-10" />
            <span className="font-medium">Drop files here</span>
            <span className="text-sm text-muted-foreground">
              Max {MAX_FILE_SIZE / 1024 / 1024}MB per file
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

interface FileUploadButtonProps {
  onFilesSelected: (files: FileList) => void
  disabled?: boolean
  variant?: 'icon' | 'button'
  className?: string
}

export function FileUploadButton({
  onFilesSelected,
  disabled,
  variant = 'icon',
  className,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFilesSelected(files)
      // Reset input so the same file can be selected again
      e.target.value = ''
    }
  }

  const acceptedTypes = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/*',
    '.js',
    '.ts',
    '.tsx',
    '.jsx',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.java',
    '.json',
    '.md',
    '.yaml',
    '.yml',
  ].join(',')

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      {variant === 'icon' ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={disabled}
          className={className}
          title="Attach files"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          disabled={disabled}
          className={cn('gap-2', className)}
        >
          <Paperclip className="h-4 w-4" />
          Attach files
        </Button>
      )}
    </>
  )
}

interface FileUploadAreaProps {
  files: PendingFile[]
  onRemoveFile: (fileId: string) => void
  onAddFiles: (files: FileList | File[]) => void
  isUploading?: boolean
  className?: string
}

export function FileUploadArea({
  files,
  onRemoveFile,
  onAddFiles,
  isUploading,
  className,
}: FileUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { isDragging, dragHandlers } = useFileUpload()

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* File preview list */}
      {files.length > 0 && (
        <FilePreviewList
          files={files}
          onRemove={isUploading ? undefined : onRemoveFile}
          size="md"
        />
      )}

      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted hover:border-muted-foreground/50 hover:bg-muted/50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={(e) => e.target.files && onAddFiles(e.target.files)}
          className="hidden"
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Images, PDFs, and code files up to {MAX_FILE_SIZE / 1024 / 1024}MB
        </p>
      </div>
    </div>
  )
}
