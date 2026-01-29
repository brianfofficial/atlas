'use client'

import { motion } from 'framer-motion'
import { Shield, Lock, Box, CheckCircle, Eye } from 'lucide-react'
import { SecurityBadge } from '@/components/help/contextual-help'

/**
 * Security Explainer Step
 *
 * Explains security features in plain language with visual metaphors.
 */
export function SecurityExplainerStep() {
  const layers = [
    {
      icon: Lock,
      emoji: '🔐',
      title: 'Your passwords are encrypted',
      description: 'We scramble them so only you can read them. Even if someone stole the files, they\'d be useless.',
      metaphor: 'Like a safe that only opens with your fingerprint',
    },
    {
      icon: Shield,
      emoji: '🛡️',
      title: 'Two-step login protects you',
      description: 'You need both your password AND a code from your phone. Attackers can\'t get in with just one.',
      metaphor: 'Like needing both a key and a PIN code',
    },
    {
      icon: Box,
      emoji: '📦',
      title: 'Commands run in isolation',
      description: 'Everything runs in a sealed "sandbox" that can\'t touch your real files or system.',
      metaphor: 'Like a virtual room that gets deleted after use',
    },
    {
      icon: CheckCircle,
      emoji: '✅',
      title: 'Only approved actions run',
      description: 'Anything not on your approved list is automatically blocked. You\'re always in control.',
      metaphor: 'Like a VIP list at a door',
    },
    {
      icon: Eye,
      emoji: '👁️',
      title: 'We verify everything',
      description: 'Every request is checked, even from inside your network. We never assume something is safe.',
      metaphor: 'Like checking ID even for regular customers',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="text-4xl mb-3"
        >
          🔒
        </motion.div>
        <h2 className="text-xl font-bold">How we keep you safe</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Multiple layers of protection, no technical setup needed
        </p>
      </div>

      {/* Security layers */}
      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
        {layers.map((layer, index) => (
          <motion.div
            key={layer.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className="flex gap-3 p-3 rounded-lg bg-background-secondary"
          >
            <div className="flex-shrink-0 text-2xl">{layer.emoji}</div>
            <div className="min-w-0">
              <div className="font-medium text-sm">{layer.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {layer.metaphor}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Active protections summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-wrap justify-center gap-2"
      >
        <SecurityBadge feature="encryption" enabled />
        <SecurityBadge feature="mfa" enabled />
        <SecurityBadge feature="sandbox" enabled />
      </motion.div>
    </div>
  )
}
