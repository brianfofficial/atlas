'use client'

import { useState, useCallback, useRef } from 'react'
import {
  uploadFile,
  validateFile,
  createPreviewUrl,
  revokePreviewUrl,
  getFileCategory,
  type UploadedFile,
  type UploadProgress,
  type FileCategory,
} from '@/lib/api/files'

export interface PendingFile {
  id: string
  file: File
  previewUrl: string
  category: FileCategory
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
  uploadedFile?: UploadedFile
}

interface UseFileUploadOptions {
  maxFiles?: number
  onUploadComplete?: (files: UploadedFile[]) => void
  onError?: (error: string) => void
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { maxFiles = 10, onUploadComplete, onError } = options
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const newPendingFiles: PendingFile[] = []

      for (const file of fileArray) {
        // Check max files limit
        if (pendingFiles.length + newPendingFiles.length >= maxFiles) {
          onError?.(`Maximum ${maxFiles} files allowed`)
          break
        }

        // Validate file
        const validation = validateFile(file)
        if (!validation.valid) {
          onError?.(validation.error || 'Invalid file')
          continue
        }

        const pendingFile: PendingFile = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          previewUrl: createPreviewUrl(file),
          category: getFileCategory(file),
          progress: 0,
          status: 'pending',
        }

        newPendingFiles.push(pendingFile)
      }

      if (newPendingFiles.length > 0) {
        setPendingFiles((prev) => [...prev, ...newPendingFiles])
      }
    },
    [pendingFiles.length, maxFiles, onError]
  )

  const removeFile = useCallback((fileId: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.id === fileId)
      if (file) {
        revokePreviewUrl(file.previewUrl)
      }
      return prev.filter((f) => f.id !== fileId)
    })
  }, [])

  const clearFiles = useCallback(() => {
    pendingFiles.forEach((file) => {
      revokePreviewUrl(file.previewUrl)
    })
    setPendingFiles([])
  }, [pendingFiles])

  const uploadFiles = useCallback(async () => {
    const filesToUpload = pendingFiles.filter((f) => f.status === 'pending')
    if (filesToUpload.length === 0) return []

    const uploadedFiles: UploadedFile[] = []

    for (const pendingFile of filesToUpload) {
      // Mark as uploading
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === pendingFile.id ? { ...f, status: 'uploading' as const } : f
        )
      )

      try {
        const result = await uploadFile(pendingFile.file, (progress: UploadProgress) => {
          setPendingFiles((prev) =>
            prev.map((f) =>
              f.id === pendingFile.id
                ? { ...f, progress: progress.percentage }
                : f
            )
          )
        })

        // Mark as complete
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id
              ? { ...f, status: 'complete' as const, progress: 100, uploadedFile: result }
              : f
          )
        )

        uploadedFiles.push(result)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'

        // Mark as error
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id
              ? { ...f, status: 'error' as const, error: errorMessage }
              : f
          )
        )

        onError?.(errorMessage)
      }
    }

    if (uploadedFiles.length > 0) {
      onUploadComplete?.(uploadedFiles)
    }

    return uploadedFiles
  }, [pendingFiles, onUploadComplete, onError])

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounter.current = 0

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles]
  )

  const dragHandlers = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  }

  return {
    pendingFiles,
    isDragging,
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    dragHandlers,
    hasFiles: pendingFiles.length > 0,
    isUploading: pendingFiles.some((f) => f.status === 'uploading'),
    uploadComplete: pendingFiles.every(
      (f) => f.status === 'complete' || f.status === 'error'
    ),
  }
}
