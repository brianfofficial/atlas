'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Key, Eye, EyeOff, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface FirstCredentialStepProps {
  onComplete: () => void
}

type ServiceType = 'openai' | 'anthropic' | 'github' | 'slack' | 'custom'

interface ServiceInfo {
  name: string
  description: string
  placeholder: string
  helpUrl: string
  helpText: string
}

const services: Record<ServiceType, ServiceInfo> = {
  openai: {
    name: 'OpenAI',
    description: 'For ChatGPT and GPT-4',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    helpText: 'Get your API key from OpenAI',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'For Claude AI',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpText: 'Get your API key from Anthropic',
  },
  github: {
    name: 'GitHub',
    description: 'For code and repos',
    placeholder: 'ghp_...',
    helpUrl: 'https://github.com/settings/tokens',
    helpText: 'Create a personal access token',
  },
  slack: {
    name: 'Slack',
    description: 'For team messaging',
    placeholder: 'xoxb-...',
    helpUrl: 'https://api.slack.com/apps',
    helpText: 'Create a Slack app to get a token',
  },
  custom: {
    name: 'Other Service',
    description: 'Any other API key',
    placeholder: 'Your API key or password',
    helpUrl: '',
    helpText: 'Enter any service credentials',
  },
}

/**
 * First Credential Step
 *
 * Guides users through adding their first API key or service connection.
 * Explains encryption in plain language.
 */
export function FirstCredentialStep({ onComplete }: FirstCredentialStepProps) {
  const [selectedService, setSelectedService] = useState<ServiceType | ''>('')
  const [apiKey, setApiKey] = useState('')
  const [nickname, setNickname] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const service = selectedService ? services[selectedService] : null

  const handleSave = async () => {
    if (!selectedService || !apiKey) return

    setIsSaving(true)

    // Simulate API call - in production this would call the credential store
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setSaved(true)
    setIsSaving(false)

    // Wait a moment to show success, then continue
    setTimeout(onComplete, 1500)
  }

  const isValid = selectedService && apiKey.length >= 8

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3"
        >
          <Key className="w-6 h-6 text-primary" />
        </motion.div>
        <h2 className="text-xl font-bold">Connect your first service</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add an API key to start automating tasks
        </p>
      </div>

      {/* Success state */}
      {saved ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center py-8 gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-success" />
          </div>
          <div className="text-center">
            <p className="font-medium">Credential saved securely!</p>
            <p className="text-sm text-muted-foreground mt-1">
              It's now encrypted with bank-level security.
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Service selection */}
          <div className="space-y-2">
            <Label htmlFor="service">What service do you want to connect?</Label>
            <Select
              value={selectedService}
              onValueChange={(value) => setSelectedService(value as ServiceType)}
            >
              <SelectTrigger id="service">
                <SelectValue placeholder="Choose a service..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(services).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span>{info.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {info.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API key input (shown after service selection) */}
          {service && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              {/* Help link */}
              {service.helpUrl && (
                <a
                  href={service.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  {service.helpText}
                </a>
              )}

              {/* Key input */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">Your API key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={service.placeholder}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Nickname */}
              <div className="space-y-2">
                <Label htmlFor="nickname">
                  Nickname{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={`e.g., "Personal ${service.name}"`}
                />
              </div>

              {/* Security note */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                <div className="text-xs text-success">
                  <strong>Your key will be encrypted immediately.</strong>
                  <br />
                  Once saved, even Atlas can't see the actual key.
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={!isValid || isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
                    />
                    Encrypting...
                  </>
                ) : (
                  'Save Securely'
                )}
              </Button>
            </motion.div>
          )}

          {/* Skip hint */}
          <p className="text-center text-xs text-muted-foreground">
            You can add more connections anytime in Settings.
          </p>
        </>
      )}
    </div>
  )
}
