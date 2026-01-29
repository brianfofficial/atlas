'use client'

import { useState, useMemo } from 'react'
import { Bot, User, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AttachedFile } from './file-preview'
import type { Message } from '@/lib/api/chat'

interface ChatMessageProps {
  message: Message
  isLatest?: boolean
  searchHighlight?: string
}

// Simple syntax highlighting patterns
const LANGUAGE_PATTERNS: Record<string, { keywords: RegExp; strings: RegExp; comments: RegExp; numbers: RegExp }> = {
  javascript: {
    keywords: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|true|false|null|undefined)\b/g,
    strings: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    numbers: /\b\d+\.?\d*\b/g,
  },
  typescript: {
    keywords: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|true|false|null|undefined|interface|type|enum|implements|extends|public|private|protected|readonly)\b/g,
    strings: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    numbers: /\b\d+\.?\d*\b/g,
  },
  python: {
    keywords: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|raise|with|lambda|True|False|None|and|or|not|in|is)\b/g,
    strings: /(["'])(?:(?!\1)[^\\]|\\.)*\1|"""[\s\S]*?"""|'''[\s\S]*?'''/g,
    comments: /#.*$/gm,
    numbers: /\b\d+\.?\d*\b/g,
  },
}

function highlightCode(code: string, language: string): string {
  const lang = language.toLowerCase()
  const patterns = LANGUAGE_PATTERNS[lang] || LANGUAGE_PATTERNS[lang === 'js' ? 'javascript' : lang === 'ts' || lang === 'tsx' ? 'typescript' : lang === 'py' ? 'python' : 'javascript']

  if (!patterns) return escapeHtml(code)

  // Tokenize and highlight
  let result = escapeHtml(code)

  // Apply highlighting in reverse order of priority
  result = result.replace(patterns.comments, '<span class="text-muted-foreground/60">$&</span>')
  result = result.replace(patterns.strings, '<span class="text-success">$&</span>')
  result = result.replace(patterns.keywords, '<span class="text-primary font-medium">$&</span>')
  result = result.replace(patterns.numbers, '<span class="text-warning">$&</span>')

  return result
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

interface CodeBlockProps {
  code: string
  language?: string
  maxLines?: number
}

function CodeBlock({ code, language = 'text', maxLines = 20 }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const lines = code.split('\n')
  const isCollapsible = lines.length > maxLines
  const displayCode = expanded || !isCollapsible ? code : lines.slice(0, maxLines).join('\n')
  const highlightedCode = useMemo(() => highlightCode(displayCode, language), [displayCode, language])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-3 rounded-lg border bg-background-secondary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          <code
            className="font-mono"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>

      {/* Line numbers (optional, shown on hover) */}
      <div className="absolute left-0 top-[33px] bottom-0 w-10 bg-muted/20 text-muted-foreground/50 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden">
        <div className="p-4 leading-relaxed">
          {displayCode.split('\n').map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      </div>

      {/* Collapse/expand button */}
      {isCollapsible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-1.5 flex items-center justify-center gap-1 text-xs text-muted-foreground border-t hover:bg-muted/30 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show {lines.length - maxLines} more lines
            </>
          )}
        </button>
      )}
    </div>
  )
}

function parseMessageContent(content: string, searchHighlight?: string): React.ReactNode[] {
  const elements: React.ReactNode[] = []
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      elements.push(
        <span key={`text-${lastIndex}`}>
          {highlightSearchTerms(text, searchHighlight)}
        </span>
      )
    }

    // Add code block
    const language = match[1] || 'text'
    const code = match[2].trim()
    elements.push(
      <CodeBlock key={`code-${match.index}`} code={code} language={language} />
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    elements.push(
      <span key={`text-${lastIndex}`}>
        {highlightSearchTerms(text, searchHighlight)}
      </span>
    )
  }

  return elements
}

function highlightSearchTerms(text: string, searchTerm?: string): React.ReactNode {
  if (!searchTerm) return text

  const parts = text.split(new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'))

  return parts.map((part, i) =>
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <mark key={i} className="bg-warning/30 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function ChatMessage({ message, isLatest, searchHighlight }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg',
        isUser ? 'bg-muted/30' : 'bg-background',
        isLatest && 'animate-in fade-in slide-in-from-bottom-2 duration-300'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isUser ? 'bg-primary/10' : 'bg-success/10'}>
          {isUser ? (
            <User className="h-4 w-4 text-primary" />
          ) : (
            <Bot className="h-4 w-4 text-success" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {isUser ? 'You' : 'Atlas'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(message.createdAt)}
          </span>
        </div>

        <div className="prose prose-sm max-w-none dark:prose-invert">
          {parseMessageContent(message.content, searchHighlight)}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.attachments.map((attachment) => (
              <AttachedFile
                key={attachment.id}
                name={attachment.name}
                size={attachment.size}
                type={attachment.type}
                url={attachment.url}
              />
            ))}
          </div>
        )}

        {/* Metadata */}
        {message.metadata && !isUser && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
            {message.metadata.model && (
              <span>{message.metadata.model}</span>
            )}
            {message.metadata.tokensUsed && (
              <span>{message.metadata.tokensUsed} tokens</span>
            )}
            {message.metadata.duration && (
              <span>{(message.metadata.duration / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface MessageListProps {
  messages: Message[]
  searchHighlight?: string
  className?: string
}

export function MessageList({ messages, searchHighlight, className }: MessageListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {messages.map((message, index) => (
        <ChatMessage
          key={message.id}
          message={message}
          isLatest={index === messages.length - 1}
          searchHighlight={searchHighlight}
        />
      ))}
    </div>
  )
}
