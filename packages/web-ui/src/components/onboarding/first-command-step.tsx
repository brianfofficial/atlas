'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Terminal, Play, Check, AlertCircle, Box, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FirstCommandStepProps {
  onComplete: () => void
}

type DemoCommand = {
  id: string
  label: string
  description: string
  command: string
  icon: typeof Terminal
  output: string[]
}

const demoCommands: DemoCommand[] = [
  {
    id: 'list',
    label: 'List files',
    description: 'See what\'s in a folder',
    command: 'ls -la ~/Desktop',
    icon: FolderOpen,
    output: [
      'drwxr-xr-x  12 you  staff   384 Jan 28 10:00 .',
      '-rw-r--r--   1 you  staff  1024 Jan 28 09:45 notes.txt',
      '-rw-r--r--   1 you  staff  2048 Jan 27 14:30 report.pdf',
      'drwxr-xr-x   3 you  staff    96 Jan 26 11:00 Projects',
    ],
  },
  {
    id: 'disk',
    label: 'Check storage',
    description: 'See how much space you have',
    command: 'df -h /',
    icon: Box,
    output: [
      'Filesystem       Size   Used  Avail Capacity  Mounted on',
      '/dev/disk1s1    460G   125G   320G    28%     /',
    ],
  },
  {
    id: 'date',
    label: 'Current time',
    description: 'Display the date and time',
    command: 'date',
    icon: Terminal,
    output: ['Tue Jan 28 10:30:00 EST 2026'],
  },
]

/**
 * First Command Step
 *
 * Lets users try a safe command to see how the sandbox works.
 * Demonstrates that commands run in isolation.
 */
export function FirstCommandStep({ onComplete }: FirstCommandStepProps) {
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [hasRun, setHasRun] = useState(false)

  const runCommand = async (cmd: DemoCommand) => {
    setSelectedCommand(cmd.id)
    setIsRunning(true)
    setOutput([])

    // Simulate command execution with streaming output
    for (let i = 0; i < cmd.output.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      setOutput((prev) => [...prev, cmd.output[i]])
    }

    setIsRunning(false)
    setHasRun(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3"
        >
          <Terminal className="w-6 h-6 text-primary" />
        </motion.div>
        <h2 className="text-xl font-bold">Try a safe command</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a command to see how the sandbox works
        </p>
      </div>

      {/* Command options */}
      <div className="grid gap-2">
        {demoCommands.map((cmd) => (
          <button
            key={cmd.id}
            onClick={() => runCommand(cmd)}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
              selectedCommand === cmd.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-background-secondary',
              isRunning && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center shrink-0">
              <cmd.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{cmd.label}</div>
              <div className="text-xs text-muted-foreground">{cmd.description}</div>
            </div>
            <Play className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>

      {/* Terminal output */}
      {(output.length > 0 || isRunning) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="rounded-lg bg-[#1a1a1a] border border-[#333] overflow-hidden"
        >
          {/* Terminal header */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#2a2a2a] border-b border-[#333]">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            <span className="ml-2 text-xs text-[#888]">
              {isRunning ? 'Running in sandbox...' : 'Sandbox output'}
            </span>
          </div>

          {/* Output */}
          <div className="p-3 font-mono text-xs text-[#ccc] max-h-[120px] overflow-y-auto">
            {selectedCommand && (
              <div className="text-[#888] mb-2">
                $ {demoCommands.find((c) => c.id === selectedCommand)?.command}
              </div>
            )}
            {output.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="whitespace-pre"
              >
                {line}
              </motion.div>
            ))}
            {isRunning && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                █
              </motion.span>
            )}
          </div>
        </motion.div>
      )}

      {/* Explanation */}
      {hasRun && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20"
        >
          <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
          <div className="text-xs">
            <strong className="text-success">That ran in the sandbox!</strong>
            <p className="text-success/80 mt-1">
              The command only saw a virtual copy of your files. It couldn't
              change or access anything real.
            </p>
          </div>
        </motion.div>
      )}

      {/* Skip hint */}
      <p className="text-center text-xs text-muted-foreground">
        This is optional - you can explore commands later.
      </p>
    </div>
  )
}
