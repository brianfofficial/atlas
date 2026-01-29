'use client'

import { useState } from 'react'
import { Download, FileText, File, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { exportToMarkdown, type ConversationWithMessages } from '@/lib/api/chat'

interface ExportDialogProps {
  conversation: ConversationWithMessages | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExportFormat = 'markdown' | 'json' | 'txt'

export function ExportDialog({ conversation, open, onOpenChange }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [includeSystem, setIncludeSystem] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!conversation) return

    setIsExporting(true)

    try {
      let content: string
      let filename: string
      let mimeType: string

      const sanitizedTitle = conversation.title
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()
        .slice(0, 50)
      const date = new Date().toISOString().split('T')[0]

      switch (format) {
        case 'markdown':
          content = exportToMarkdown(conversation, { includeSystem })
          filename = `${sanitizedTitle}-${date}.md`
          mimeType = 'text/markdown'
          break

        case 'json':
          const jsonData = {
            title: conversation.title,
            exportedAt: new Date().toISOString(),
            messageCount: conversation.messages.length,
            messages: includeSystem
              ? conversation.messages
              : conversation.messages.filter((m) => m.role !== 'system'),
          }
          content = JSON.stringify(jsonData, null, 2)
          filename = `${sanitizedTitle}-${date}.json`
          mimeType = 'application/json'
          break

        case 'txt':
          content = exportToPlainText(conversation, { includeSystem })
          filename = `${sanitizedTitle}-${date}.txt`
          mimeType = 'text/plain'
          break
      }

      // Create and trigger download
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onOpenChange(false)
    } finally {
      setIsExporting(false)
    }
  }

  const formatOptions: Array<{
    value: ExportFormat
    label: string
    description: string
    icon: typeof FileText
  }> = [
    {
      value: 'markdown',
      label: 'Markdown',
      description: 'Best for documentation and notes',
      icon: FileText,
    },
    {
      value: 'json',
      label: 'JSON',
      description: 'Full data with metadata',
      icon: File,
    },
    {
      value: 'txt',
      label: 'Plain Text',
      description: 'Simple, readable format',
      icon: FileText,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Conversation</DialogTitle>
          <DialogDescription>
            Download this conversation in your preferred format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format selection */}
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid gap-2">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormat(option.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    format === option.value
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      format === option.value ? 'bg-primary/10' : 'bg-muted'
                    }`}
                  >
                    <option.icon
                      className={`h-5 w-5 ${
                        format === option.value ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                  {format === option.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="include-system" className="font-medium">
                Include system messages
              </Label>
              <p className="text-xs text-muted-foreground">
                System prompts and configuration
              </p>
            </div>
            <Switch
              id="include-system"
              checked={includeSystem}
              onCheckedChange={setIncludeSystem}
            />
          </div>

          {/* Preview info */}
          {conversation && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium">{conversation.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {conversation.messages.filter((m) => includeSystem || m.role !== 'system').length}{' '}
                messages will be exported
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!conversation || isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function exportToPlainText(
  conversation: ConversationWithMessages,
  options?: { includeSystem?: boolean }
): string {
  const lines: string[] = []

  lines.push(conversation.title)
  lines.push('='.repeat(conversation.title.length))
  lines.push('')
  lines.push(`Exported on ${new Date().toLocaleDateString()}`)
  lines.push('')
  lines.push('-'.repeat(40))
  lines.push('')

  for (const message of conversation.messages) {
    if (message.role === 'system' && !options?.includeSystem) continue

    const roleLabel = {
      user: 'You',
      assistant: 'Atlas',
      system: '[System]',
    }[message.role]

    const time = new Date(message.createdAt).toLocaleString()

    lines.push(`${roleLabel} (${time}):`)
    lines.push('')
    lines.push(message.content)
    lines.push('')
    lines.push('-'.repeat(40))
    lines.push('')
  }

  return lines.join('\n')
}
