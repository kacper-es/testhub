'use client'

import { useState } from 'react'
import { SIDEBAR_COOKIE } from '@/lib/nav'
import { NavIcon } from '@/components/nav/NavIcon'

// UI-4: the sidebar shell with a collapse toggle (desktop only). The state lives
// in a cookie, so the server renders the right width on the next load (no flash).
// Children react to `data-collapsed` through `group/sb` variants.
export function SidebarFrame({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <aside
      data-collapsed={collapsed}
      className="group/sb z-40 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-bg px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-7 lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r lg:px-4 lg:py-6 motion-safe:lg:transition-[width] lg:data-[collapsed=true]:w-16 lg:data-[collapsed=true]:px-2"
    >
      {children}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        title={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}
        className="hidden items-center gap-2 rounded-[3px] px-3 py-2 text-xs font-medium text-muted hover:bg-surface-raised hover:text-fg lg:-mt-4 lg:flex lg:group-data-[collapsed=true]/sb:justify-center lg:group-data-[collapsed=true]/sb:px-0"
      >
        <NavIcon name={collapsed ? 'expand' : 'collapse'} />
        <span className="lg:group-data-[collapsed=true]/sb:sr-only">
          {collapsed ? 'Rozwiń menu' : 'Zwiń menu'}
        </span>
      </button>
    </aside>
  )
}
