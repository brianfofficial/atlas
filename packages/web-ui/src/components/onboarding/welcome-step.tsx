'use client'

import { motion } from 'framer-motion'
import { Sparkles, Shield, Zap, Lock } from 'lucide-react'

/**
 * Welcome Step
 *
 * First step of onboarding - introduces Atlas and its benefits.
 */
export function WelcomeStep() {
  const features = [
    {
      icon: Shield,
      title: 'Security First',
      description: 'Bank-level protection for all your data',
    },
    {
      icon: Zap,
      title: 'Automate Tasks',
      description: 'Let AI handle repetitive work safely',
    },
    {
      icon: Lock,
      title: 'You\'re in Control',
      description: 'Only approved actions can run',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/50 mb-4"
        >
          <Sparkles className="w-8 h-8 text-primary-foreground" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold"
        >
          Welcome to Atlas
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground mt-2"
        >
          Your secure AI assistant for automating tasks
        </motion.p>
      </div>

      {/* Features */}
      <div className="space-y-3">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-background-secondary"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <feature.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-medium">{feature.title}</div>
              <div className="text-sm text-muted-foreground">
                {feature.description}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Reassurance */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center text-sm text-muted-foreground"
      >
        This quick setup takes about 5 minutes.
        <br />
        Your data stays on your device.
      </motion.p>
    </div>
  )
}
