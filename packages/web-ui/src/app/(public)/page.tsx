'use client'

import Link from 'next/link'
import {
  Shield,
  Lock,
  Key,
  Container,
  Network,
  FileSearch,
  ShieldAlert,
  Terminal,
  ArrowRight,
  Check,
  X,
  AlertTriangle,
  Zap,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const securityLayers = [
  {
    icon: Key,
    title: 'Encrypted Credentials',
    description: 'AES-256-GCM encryption with OS keychain integration. Your secrets never touch plaintext.',
    status: 'active',
    metric: '256-bit',
  },
  {
    icon: Lock,
    title: 'Mandatory MFA',
    description: 'TOTP-based two-factor authentication. Not optional. Not bypassable. Required.',
    status: 'active',
    metric: 'Required',
  },
  {
    icon: Container,
    title: 'Docker Sandboxing',
    description: 'Every command runs in an isolated container. Read-only root, dropped capabilities, seccomp filtering.',
    status: 'active',
    metric: 'Isolated',
  },
  {
    icon: Network,
    title: 'Zero-Trust Network',
    description: 'No implicit localhost trust. Explicit IP allowlists. Every connection authenticated.',
    status: 'active',
    metric: 'Verified',
  },
  {
    icon: Terminal,
    title: 'Command Allowlisting',
    description: 'Deny-by-default for all commands. Only pre-approved operations execute.',
    status: 'active',
    metric: 'Allowlist',
  },
  {
    icon: ShieldAlert,
    title: 'Prompt Injection Defense',
    description: 'Multi-layer sanitization. XML-tagged isolation. Known pattern detection.',
    status: 'active',
    metric: '40+ patterns',
  },
  {
    icon: FileSearch,
    title: 'Output Validation',
    description: 'Credential exfiltration blocking. Suspicious host detection. Nothing leaks.',
    status: 'active',
    metric: 'Scanned',
  },
]

const comparisonData = [
  { feature: 'Credential Storage', moltbot: 'Plaintext JSON', atlas: 'AES-256-GCM Encrypted', critical: true },
  { feature: 'Authentication', moltbot: 'Optional', atlas: 'Mandatory MFA', critical: true },
  { feature: 'Localhost Trust', moltbot: 'Implicit (dangerous)', atlas: 'Zero-trust', critical: true },
  { feature: 'Command Execution', moltbot: 'Unrestricted', atlas: 'Sandboxed + Allowlist', critical: true },
  { feature: 'Prompt Injection Defense', moltbot: 'None', atlas: 'Multi-layer', critical: true },
  { feature: 'Output Validation', moltbot: 'None', atlas: 'Credential detection', critical: false },
  { feature: 'Audit Logging', moltbot: 'Basic', atlas: 'Comprehensive', critical: false },
  { feature: 'Network Security', moltbot: 'Open by default', atlas: 'Allowlist required', critical: true },
]

export default function LandingPage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating security indicators */}
        <div className="absolute top-1/4 right-1/4 animate-pulse-glow">
          <div className="p-4 rounded-2xl bg-success/10 border border-success/20">
            <Shield className="h-8 w-8 text-success" />
          </div>
        </div>
        <div className="absolute bottom-1/3 left-1/4 animate-pulse-glow animation-delay-200">
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <Lock className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-3xl">
            {/* Alert badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-danger/10 border border-danger/20 mb-8">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <span className="text-sm text-danger">
                300+ AI assistants exposed via Shodan. Yours could be next.
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="gradient-text">Security</span>
              <br />
              should never be
              <br />
              <span className="text-muted-foreground">optional.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl">
              Atlas is a security-hardened AI assistant built from first principles.
              Every credential encrypted. Every command sandboxed. Every request authenticated.
              <span className="text-foreground font-medium"> No exceptions.</span>
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-4 mb-12">
              <Button size="lg" className="gap-2 glow-primary" asChild>
                <Link href="/login">
                  Start Protected
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="gap-2" asChild>
                <Link href="#security">
                  <Eye className="h-4 w-4" />
                  See How It Works
                </Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="status-dot status-dot-success" />
                7 Security Layers
              </div>
              <div className="flex items-center gap-2">
                <div className="status-dot status-dot-success" />
                Zero Plaintext Storage
              </div>
              <div className="flex items-center gap-2">
                <div className="status-dot status-dot-success" />
                MFA Required
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-24 bg-background-secondary">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="danger" className="mb-4">The Problem</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              AI assistants are being{' '}
              <span className="text-danger">compromised daily</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Security researchers discovered critical vulnerabilities in popular AI assistants.
              Credentials stolen in under 5 minutes. Prompt injection attacks. Supply chain poisoning.
              This isn&apos;t theoretical. It&apos;s happening now.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                stat: '300+',
                label: 'Exposed instances found on Shodan',
                severity: 'danger',
              },
              {
                stat: '5 min',
                label: 'Time to steal credentials via injection',
                severity: 'warning',
              },
              {
                stat: '0',
                label: 'Authentication required by default',
                severity: 'danger',
              },
            ].map((item) => (
              <Card key={item.label} className="bg-background border-border/50">
                <CardContent className="p-6 text-center">
                  <div className={`text-4xl font-bold mb-2 text-${item.severity}`}>
                    {item.stat}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security Layers Section */}
      <section id="security" className="py-24 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge className="mb-4">Defense in Depth</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              7 layers of protection.{' '}
              <span className="gradient-text">Zero compromises.</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Atlas doesn&apos;t bolt security on as an afterthought. Every layer is enforced,
              audited, and required. There are no backdoors. No bypasses. No exceptions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityLayers.map((layer, index) => {
              const Icon = layer.icon
              return (
                <Card
                  key={layer.title}
                  className="bg-background border-border/50 card-hover group"
                  hover
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="status-dot status-dot-success" />
                        <span className="text-xs text-muted-foreground font-mono">
                          {layer.metric}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{layer.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {layer.description}
                    </p>
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <span className="text-xs text-success flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Enforced &amp; Audited
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="py-24 bg-background-secondary scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="secondary" className="mb-4">Why Atlas</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              See the difference
            </h2>
            <p className="text-lg text-muted-foreground">
              Atlas was built to fix every vulnerability found in existing AI assistants.
              Here&apos;s how it compares.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 bg-background-tertiary">
                <div className="p-4 text-sm font-semibold">Feature</div>
                <div className="p-4 text-sm font-semibold text-center border-l border-border/50">
                  <span className="text-muted-foreground">Others</span>
                </div>
                <div className="p-4 text-sm font-semibold text-center border-l border-border/50">
                  <span className="gradient-text">Atlas</span>
                </div>
              </div>

              {/* Rows */}
              {comparisonData.map((row, index) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-3 ${
                    index % 2 === 0 ? 'bg-background' : 'bg-background-secondary'
                  }`}
                >
                  <div className="p-4 text-sm flex items-center gap-2">
                    {row.critical && (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                    )}
                    {row.feature}
                  </div>
                  <div className="p-4 text-sm text-center border-l border-border/50 flex items-center justify-center gap-2">
                    <X className="h-4 w-4 text-danger" />
                    <span className="text-muted-foreground">{row.moltbot}</span>
                  </div>
                  <div className="p-4 text-sm text-center border-l border-border/50 flex items-center justify-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span className="text-foreground">{row.atlas}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="secondary" className="mb-4">Beyond Security</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Built for power users
            </h2>
            <p className="text-lg text-muted-foreground">
              Security doesn&apos;t mean sacrificing functionality.
              Atlas gives you everything you need to work effectively.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: Zap,
                title: 'Local Model Routing',
                description: 'Route simple tasks to local Ollama models for free. Complex tasks go to Claude. You control the tradeoff.',
              },
              {
                icon: Terminal,
                title: 'Command Palette',
                description: 'Access everything with Cmd+K. Weather, calendar, GitHub PRs, email summaries - all inline.',
              },
              {
                icon: Eye,
                title: 'Full Audit Trail',
                description: 'Every action logged. Every decision traceable. Complete visibility into what your AI does.',
              },
              {
                icon: Shield,
                title: 'Human-in-the-Loop',
                description: 'Approve dangerous operations before they execute. Set rules for auto-approval. Stay in control.',
              },
            ].map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="bg-background-secondary border-border/50">
                  <CardContent className="p-6 flex gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 h-fit">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-background-secondary">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative rounded-2xl overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-purple-500/20" />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
            />

            {/* Content */}
            <div className="relative z-10 p-12 md:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Ready to work securely?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join the developers who refuse to compromise on security.
                Start with Atlas today.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" className="gap-2 glow-primary" asChild>
                  <Link href="/login">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="#">View Documentation</Link>
                </Button>
              </div>

              {/* Trust bar */}
              <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="status-dot status-dot-success" />
                  Open Source
                </div>
                <div className="flex items-center gap-2">
                  <div className="status-dot status-dot-success" />
                  Self-Hostable
                </div>
                <div className="flex items-center gap-2">
                  <div className="status-dot status-dot-success" />
                  Privacy Focused
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
