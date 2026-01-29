'use client'

import { motion } from 'framer-motion'
import { Key, Plus, Shield, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface EmptyCredentialsProps {
  onAdd?: () => void
}

/**
 * Empty state for credentials page
 */
export function EmptyCredentials({ onAdd }: EmptyCredentialsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
      >
        <Key className="w-10 h-10 text-primary" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-bold mb-2"
      >
        No credentials yet
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground mb-6 max-w-md"
      >
        Add API keys and passwords to connect Atlas to your services.
        All credentials are encrypted with bank-level security.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col items-center gap-4"
      >
        <Button onClick={onAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Add your first credential
        </Button>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-success" />
          <span>Encrypted with AES-256-GCM</span>
        </div>
      </motion.div>

      {/* Service icons preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex items-center gap-3 text-muted-foreground"
      >
        <span className="text-xs">Connect to:</span>
        <div className="flex items-center gap-2">
          {['OpenAI', 'GitHub', 'Slack', 'AWS'].map((service, i) => (
            <span
              key={service}
              className="px-2 py-1 text-xs rounded bg-background-secondary border border-border"
            >
              {service}
            </span>
          ))}
          <span className="text-xs">+ more</span>
        </div>
      </motion.div>
    </motion.div>
  )
}
