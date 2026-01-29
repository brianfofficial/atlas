'use client'

import { X, FileText, Code, Image as ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/api/files'
import type { PendingFile } from '@/hooks/use-file-upload'

interface FilePreviewProps {
  file: PendingFile
  onRemove?: () => void
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
}

export function FilePreview({
  file,
  onRemove,
  size = 'md',
  showProgress = true,
}: FilePreviewProps) {
  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  }

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  const CategoryIcon = {
    image: ImageIcon,
    document: FileText,
    code: Code,
  }[file.category]

  const isUploading = file.status === 'uploading'
  const hasError = file.status === 'error'
  const isComplete = file.status === 'complete'

  return (
    <div
      className={cn(
        'relative group rounded-lg border bg-background-secondary overflow-hidden',
        sizeClasses[size],
        hasError && 'border-danger/50',
        isComplete && 'border-success/50'
      )}
    >
      {/* Preview content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {file.category === 'image' ? (
          <img
            src={file.previewUrl}
            alt={file.file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 p-2">
            <CategoryIcon className={cn('text-muted-foreground', iconSizes[size])} />
            {size !== 'sm' && (
              <span className="text-xs text-muted-foreground truncate max-w-full px-1">
                {file.file.name.length > 12
                  ? file.file.name.slice(0, 10) + '...'
                  : file.file.name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress overlay */}
      {showProgress && isUploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-medium">{file.progress}%</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-danger/20 flex items-center justify-center">
          <span className="text-xs text-danger font-medium px-1 text-center">
            {file.error || 'Error'}
          </span>
        </div>
      )}

      {/* Remove button */}
      {onRemove && !isUploading && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger hover:text-danger-foreground hover:border-danger"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Progress bar at bottom */}
      {showProgress && isUploading && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${file.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface FilePreviewListProps {
  files: PendingFile[]
  onRemove?: (fileId: string) => void
  size?: 'sm' | 'md' | 'lg'
}

export function FilePreviewList({ files, onRemove, size = 'md' }: FilePreviewListProps) {
  if (files.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {files.map((file) => (
        <FilePreview
          key={file.id}
          file={file}
          onRemove={onRemove ? () => onRemove(file.id) : undefined}
          size={size}
        />
      ))}
    </div>
  )
}

interface AttachedFileProps {
  name: string
  size: number
  type: string
  url?: string
}

export function AttachedFile({ name, size, type, url }: AttachedFileProps) {
  const isImage = type.startsWith('image/')

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 rounded-lg border bg-background-secondary hover:bg-muted transition-colors max-w-xs"
    >
      {isImage && url ? (
        <img src={url} alt={name} className="h-10 w-10 rounded object-cover" />
      ) : (
        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
      </div>
    </a>
  )
}
