/**
 * File Upload API
 *
 * Handles file uploads for chat attachments with progress tracking.
 */

import { tokenManager } from './client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18789'

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  thumbnailUrl?: string
  createdAt: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export type UploadProgressCallback = (progress: UploadProgress) => void

/**
 * Allowed file types with their MIME types
 */
export const ALLOWED_FILE_TYPES = {
  // Images
  'image/png': { ext: '.png', category: 'image' },
  'image/jpeg': { ext: '.jpg', category: 'image' },
  'image/gif': { ext: '.gif', category: 'image' },
  'image/webp': { ext: '.webp', category: 'image' },
  // Documents
  'application/pdf': { ext: '.pdf', category: 'document' },
  // Code
  'text/plain': { ext: '.txt', category: 'code' },
  'text/javascript': { ext: '.js', category: 'code' },
  'text/typescript': { ext: '.ts', category: 'code' },
  'application/json': { ext: '.json', category: 'code' },
  'text/html': { ext: '.html', category: 'code' },
  'text/css': { ext: '.css', category: 'code' },
  'text/markdown': { ext: '.md', category: 'code' },
  'text/x-python': { ext: '.py', category: 'code' },
  'application/x-python': { ext: '.py', category: 'code' },
} as const

export type FileCategory = 'image' | 'document' | 'code'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Validate a file for upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    }
  }

  // Check type
  const typeInfo = ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]
  if (!typeInfo) {
    // Allow files with code-like extensions even if MIME type is not recognized
    const ext = file.name.split('.').pop()?.toLowerCase()
    const codeExtensions = ['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'sh', 'yaml', 'yml', 'toml', 'sql', 'graphql']
    if (ext && codeExtensions.includes(ext)) {
      return { valid: true }
    }
    return {
      valid: false,
      error: `File type "${file.type || 'unknown'}" is not supported`,
    }
  }

  return { valid: true }
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(file: File): FileCategory {
  const typeInfo = ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]
  if (typeInfo) {
    return typeInfo.category
  }
  // Default to code for unknown types (if they pass validation)
  return 'code'
}

/**
 * Upload a file with progress tracking
 */
export async function uploadFile(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<UploadedFile> {
  const token = tokenManager.getToken()

  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        })
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve(response)
        } catch {
          reject(new Error('Invalid response from server'))
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.message || `Upload failed: ${xhr.status}`))
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'))
    })

    xhr.open('POST', `${API_BASE}/api/files/upload`)
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    xhr.send(formData)
  })
}

/**
 * Upload multiple files
 */
export async function uploadFiles(
  files: File[],
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<UploadedFile[]> {
  const results: UploadedFile[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const result = await uploadFile(file, (progress) => {
      onProgress?.(i, progress)
    })
    results.push(result)
  }

  return results
}

/**
 * Delete an uploaded file
 */
export async function deleteFile(fileId: string): Promise<void> {
  const token = tokenManager.getToken()

  const response = await fetch(`${API_BASE}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    throw new Error('Failed to delete file')
  }
}

/**
 * Create a preview URL for a file (client-side)
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * Revoke a preview URL to free memory
 */
export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url)
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
