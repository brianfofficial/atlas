'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Shield, Loader2, Smartphone } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/use-auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const mfaSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
})

type LoginForm = z.infer<typeof loginSchema>
type MFAForm = z.infer<typeof mfaSchema>

type AuthStep = 'credentials' | 'mfa'

export default function LoginPage() {
  const router = useRouter()
  const {
    login,
    verifyMFA,
    requiresMFA,
    isLoggingIn,
    isVerifyingMFA,
    loginError,
    verifyMFAError,
    isAuthenticated,
  } = useAuth()

  const [step, setStep] = useState<AuthStep>('credentials')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = sessionStorage.getItem('atlas_redirect') || '/'
      sessionStorage.removeItem('atlas_redirect')
      router.push(redirect)
    }
  }, [isAuthenticated, router])

  // Switch to MFA step when required
  useEffect(() => {
    if (requiresMFA) {
      setStep('mfa')
    }
  }, [requiresMFA])

  // Handle errors
  useEffect(() => {
    if (loginError) {
      setError(loginError.message || 'Invalid email or password')
    } else if (verifyMFAError) {
      setError(verifyMFAError.message || 'Invalid verification code')
    }
  }, [loginError, verifyMFAError])

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const mfaForm = useForm<MFAForm>({
    resolver: zodResolver(mfaSchema),
    defaultValues: {
      code: '',
    },
  })

  async function onLoginSubmit(data: LoginForm) {
    setError(null)
    try {
      await login(data.email, data.password)
      // If MFA is required, useEffect will handle switching to MFA step
      // If not (shouldn't happen in Atlas), we'll be redirected via isAuthenticated
    } catch (err) {
      // Error is handled by useEffect watching loginError
    }
  }

  async function onMFASubmit(data: MFAForm) {
    setError(null)
    try {
      await verifyMFA(data.code)
      // Successful verification will trigger isAuthenticated useEffect
    } catch (err) {
      // Error is handled by useEffect watching verifyMFAError
    }
  }

  const isLoading = isLoggingIn || isVerifyingMFA

  return (
    <AnimatePresence mode="wait">
      {step === 'credentials' ? (
        <motion.div
          key="credentials"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="space-y-1 px-0">
              <div className="flex items-center gap-2 lg:hidden mb-4">
                <Shield className="h-6 w-6 text-primary" />
                <span className="font-bold text-xl">Atlas</span>
              </div>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription>
                Sign in to access your security dashboard
              </CardDescription>
            </CardHeader>

            <CardContent className="px-0">
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                {error && (
                  <Alert variant="danger">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    autoComplete="email"
                    disabled={isLoading}
                    {...loginForm.register('email')}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-danger">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={isLoading}
                      {...loginForm.register('password')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-danger">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      New to Atlas?
                    </span>
                  </div>
                </div>

                <Link href="/setup-mfa">
                  <Button variant="outline" className="w-full mt-4">
                    Create account
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          key="mfa"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="space-y-1 px-0">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">Two-factor authentication</CardTitle>
              <CardDescription>
                Enter the 6-digit code from your authenticator app
              </CardDescription>
            </CardHeader>

            <CardContent className="px-0">
              <form onSubmit={mfaForm.handleSubmit(onMFASubmit)} className="space-y-4">
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
                    autoComplete="one-time-code"
                    maxLength={6}
                    disabled={isLoading}
                    className="text-center text-2xl tracking-widest font-mono"
                    {...mfaForm.register('code')}
                  />
                  {mfaForm.formState.errors.code && (
                    <p className="text-xs text-danger">
                      {mfaForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('credentials')}
                  disabled={isLoading}
                >
                  Back to login
                </Button>
              </form>

              <div className="mt-6 p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  Lost access to your authenticator?{' '}
                  <Link href="/recovery" className="text-primary hover:underline">
                    Use a backup code
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
