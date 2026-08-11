'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isNavItemActive } from '@/lib/nav'
import { cn } from '@/lib/cn'

// Główna nawigacja sekcji. Aktywny stan zależy od bieżącej ścieżki,
// dlatego to cienki komponent kliencki (reszta shellu zostaje serwerowa).
export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <nav aria-label="Główna nawigacja" className="flex flex-wrap items-center gap-1 text-sm">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition-colors',
              active
                ? 'bg-fg text-bg'
                : 'text-muted hover:bg-surface-raised hover:text-fg',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
