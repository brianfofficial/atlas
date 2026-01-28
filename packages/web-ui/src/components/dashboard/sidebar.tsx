'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield,
  LayoutDashboard,
  Key,
  ListChecks,
  Container,
  DollarSign,
  Settings,
  Network,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Security',
    href: '/security',
    icon: Shield,
  },
  {
    title: 'Credentials',
    href: '/security/credentials',
    icon: Key,
  },
  {
    title: 'Allowlist',
    href: '/security/allowlist',
    icon: ListChecks,
  },
  {
    title: 'Sandbox',
    href: '/sandbox',
    icon: Container,
  },
  {
    title: 'Costs',
    href: '/costs',
    icon: DollarSign,
  },
  {
    title: 'Network',
    href: '/settings/network',
    icon: Network,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen border-r bg-background-secondary transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            {!collapsed && (
              <span className="font-bold text-lg gradient-text">Atlas</span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium">{item.title}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.title}</p>
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.href}>{linkContent}</div>
          })}
        </nav>

        {/* Status indicator at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <div className="status-dot status-dot-success" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>All systems operational</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="status-dot status-dot-success" />
              <span>All systems operational</span>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
