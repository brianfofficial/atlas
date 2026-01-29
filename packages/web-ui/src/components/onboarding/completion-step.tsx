'use client'

import { motion } from 'framer-motion'
import { Check, ArrowRight, Shield, Key, Terminal, DollarSign } from 'lucide-react'
import Link from 'next/link'

/**
 * Completion Step
 *
 * Celebrates completion and shows next steps.
 */
export function CompletionStep() {
  const quickLinks = [
    {
      icon: Key,
      title: 'Add more connections',
      description: 'Connect other services',
      href: '/security/credentials',
    },
    {
      icon: Shield,
      title: 'Review security',
      description: 'See your protections',
      href: '/security',
    },
    {
      icon: Terminal,
      title: 'Run commands',
      description: 'Try the sandbox',
      href: '/sandbox',
    },
    {
      icon: DollarSign,
      title: 'Set a budget',
      description: 'Control AI costs',
      href: '/costs',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Success animation */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 mb-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.3 }}
          >
            <Check className="w-8 h-8 text-success" />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-bold"
        >
          You're all set!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground mt-2"
        >
          Atlas is ready to help you automate safely
        </motion.p>
      </div>

      {/* Summary badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap justify-center gap-2"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-success/10 text-success">
          <Check className="w-3 h-3" />
          Bank-level encryption
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-success/10 text-success">
          <Check className="w-3 h-3" />
          Two-step login enabled
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-success/10 text-success">
          <Check className="w-3 h-3" />
          Sandbox protection active
        </div>
      </motion.div>

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="space-y-2"
      >
        <p className="text-sm text-muted-foreground text-center mb-3">
          What would you like to do first?
        </p>

        <div className="grid grid-cols-2 gap-2">
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + index * 0.1 }}
            >
              <Link
                href={link.href}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-background-secondary transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <link.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <div className="text-sm font-medium">{link.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {link.description}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Help reminder */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-center text-xs text-muted-foreground"
      >
        Need help? Click the <span className="text-primary">?</span> icon
        anywhere for guidance.
      </motion.p>
    </div>
  )
}
