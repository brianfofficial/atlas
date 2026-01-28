'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Smartphone,
  QrCode,
  KeyRound,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StepIndicator } from '@/components/ui/step-indicator'
import { generateBackupCode } from '@/lib/utils'

const STEPS = [
  { label: 'Intro' },
  { label: 'App' },
  { label: 'Scan' },
  { label: 'Verify' },
  { label: 'Backup' },
  { label: 'Confirm' },
  { label: 'Done' },
]

// Generate backup codes once
const BACKUP_CODES = Array.from({ length: 10 }, () => generateBackupCode())

export default function SetupMFAPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [verificationCode, setVerificationCode] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  // Mock TOTP secret - in production this comes from the backend
  const totpSecret = 'JBSWY3DPEHPK3PXP'
  const totpUri = `otpauth://totp/Atlas:admin@example.com?secret=${totpSecret}&issuer=Atlas`

  const nextStep = () => {
    setError(null)
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const prevStep = () => {
    setError(null)
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Simulate verification
      await new Promise((r) => setTimeout(r, 1000))
      // Accept any 6-digit code for demo
      nextStep()
    } catch {
      setError('Invalid verification code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const confirmBackupCode = async () => {
    if (!BACKUP_CODES.includes(confirmationCode.toUpperCase())) {
      setError('Code does not match any backup code')
      return
    }

    setIsLoading(true)
    try {
      await new Promise((r) => setTimeout(r, 500))
      nextStep()
    } finally {
      setIsLoading(false)
    }
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(BACKUP_CODES.join('\n'))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  const downloadBackupCodes = () => {
    const content = `Atlas Backup Codes
Generated: ${new Date().toISOString()}

IMPORTANT: Store these codes securely. Each code can only be used once.

${BACKUP_CODES.map((code, i) => `${i + 1}. ${code}`).join('\n')}

If you lose access to your authenticator app, use one of these codes to sign in.
`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'atlas-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Introduction
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10 glow-primary">
                <Shield className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">
                Secure your account with 2FA
              </h2>
              <p className="text-muted-foreground text-sm">
                Two-factor authentication adds an extra layer of security by
                requiring a code from your phone in addition to your password.
              </p>
            </div>
            <div className="space-y-3">
              {[
                {
                  icon: Smartphone,
                  title: 'Required for all accounts',
                  desc: 'Atlas requires 2FA to protect your credentials',
                },
                {
                  icon: KeyRound,
                  title: 'Backup codes provided',
                  desc: "You'll get 10 one-time codes in case you lose your phone",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <item.icon className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={nextStep} className="w-full">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )

      case 1: // Choose authenticator app
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">
                Install an authenticator app
              </h2>
              <p className="text-muted-foreground text-sm">
                You'll need an authenticator app to generate verification codes.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Google Authenticator', platform: 'iOS & Android' },
                { name: 'Microsoft Authenticator', platform: 'iOS & Android' },
                { name: '1Password', platform: 'All platforms' },
                { name: 'Authy', platform: 'iOS, Android, Desktop' },
              ].map((app) => (
                <div
                  key={app.name}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium">{app.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.platform}
                    </p>
                  </div>
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={nextStep} className="flex-1">
                I have an app
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )

      case 2: // QR Code
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Scan QR code</h2>
              <p className="text-muted-foreground text-sm">
                Open your authenticator app and scan this QR code.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-xl">
                {/* Placeholder QR code - in production use qrcode library */}
                <div className="w-48 h-48 bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center">
                  <QrCode className="h-24 w-24 text-white" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                Can't scan? Enter this code manually:
              </p>
              <div className="flex items-center justify-center gap-2">
                <code className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                  {totpSecret}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(totpSecret)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={nextStep} className="flex-1">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )

      case 3: // Verify code
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Verify setup</h2>
              <p className="text-muted-foreground text-sm">
                Enter the 6-digit code from your authenticator app to verify
                setup.
              </p>
            </div>
            {error && (
              <Alert variant="danger">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, ''))
                }
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={verifyCode}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Verify
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )

      case 4: // Backup codes
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Save your backup codes</h2>
              <p className="text-muted-foreground text-sm">
                Store these codes securely. Each code can only be used once.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                {BACKUP_CODES.map((code, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 bg-background rounded border border-border font-mono text-sm text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={copyBackupCodes}
                className="flex-1"
              >
                <Copy className="mr-2 h-4 w-4" />
                {copiedCodes ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="outline"
                onClick={downloadBackupCodes}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
            <Alert variant="warning">
              <AlertDescription>
                Without these codes, you may lose access to your account if you
                lose your phone.
              </AlertDescription>
            </Alert>
            <Button onClick={nextStep} className="w-full">
              I've saved my codes
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )

      case 5: // Confirm backup code
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Confirm backup codes</h2>
              <p className="text-muted-foreground text-sm">
                Enter one of your backup codes to confirm you've saved them.
              </p>
            </div>
            {error && (
              <Alert variant="danger">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="backup">Backup code</Label>
              <Input
                id="backup"
                type="text"
                placeholder="XXXX-XXXX"
                value={confirmationCode}
                onChange={(e) =>
                  setConfirmationCode(e.target.value.toUpperCase())
                }
                className="text-center text-lg tracking-widest font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={confirmBackupCode}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Confirm
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )

      case 6: // Success
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="p-4 rounded-full bg-success/10 glow-success"
              >
                <CheckCircle2 className="h-12 w-12 text-success" />
              </motion.div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">
                Two-factor authentication enabled
              </h2>
              <p className="text-muted-foreground text-sm">
                Your account is now protected with an additional layer of
                security.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="text-sm">Authenticator app configured</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="text-sm">10 backup codes saved</p>
              </div>
            </div>
            <Button onClick={() => router.push('/')} className="w-full">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pb-8">
        <StepIndicator steps={STEPS} currentStep={currentStep} />
      </CardHeader>
      <CardContent className="px-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
