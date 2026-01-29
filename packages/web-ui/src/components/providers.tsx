'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { HelpProvider } from '@/hooks/use-help'
import { HelpSidebar } from '@/components/help/help-sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/components/auth/auth-provider'
import { CommandProvider } from '@/components/command/command-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <HelpProvider>
            <CommandProvider>
              {children}
              <HelpSidebar />
              <Toaster />
            </CommandProvider>
          </HelpProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
