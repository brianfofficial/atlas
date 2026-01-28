import { Shield } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-background-secondary relative overflow-hidden">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-purple-500/20" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-primary/20 glow-primary">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold gradient-text">Atlas</h1>
              <p className="text-sm text-muted-foreground">Security Dashboard</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">
                Security-hardened AI assistant
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Built on the principle that security should never be optional.
                Every credential encrypted, every action sandboxed, every
                request authenticated.
              </p>
            </div>

            <div className="grid gap-4">
              {[
                {
                  title: 'Encrypted credentials',
                  description: 'AES-256-GCM encryption with OS keychain integration',
                },
                {
                  title: 'Mandatory MFA',
                  description: 'TOTP-based two-factor authentication required',
                },
                {
                  title: 'Docker sandboxing',
                  description: 'Every command runs in an isolated container',
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 p-4 rounded-lg bg-background/50 border border-border/50"
                >
                  <div className="status-dot status-dot-success mt-1.5" />
                  <div>
                    <h3 className="font-medium text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
