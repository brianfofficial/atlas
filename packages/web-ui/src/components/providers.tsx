'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { HelpProvider } from '@/hooks/use-help'
import { HelpSidebar } from '@/components/help/help-sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

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
        <HelpProvider>
          {children}
          <HelpSidebar />
          <Toaster />
        </HelpProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
