'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Theme } from '@prisma/client'
import { setTheme } from '@/app/actions/theme'
import { THEME_LABELS } from '@/lib/theme'
import { cn } from '@/lib/cn'

const OPTIONS: Theme[] = ['LIGHT', 'DARK', 'SYSTEM']

export function ThemeToggle({ current }: { current: Theme }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function apply(theme: Theme) {
    // Optymistyczne przełączenie klasy na <html> — natychmiastowy efekt.
    const el = document.documentElement
    el.classList.remove('light', 'dark')
    if (theme === 'LIGHT') el.classList.add('light')
    else if (theme === 'DARK') el.classList.add('dark')
    // SYSTEM: brak klasy → media query.
    start(async () => {
      await setTheme(theme)
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label="Motyw"
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => apply(o)}
          disabled={pending}
          aria-pressed={current === o}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            current === o ? 'bg-fg text-bg' : 'text-fg hover:bg-surface-raised',
          )}
        >
          {THEME_LABELS[o]}
        </button>
      ))}
    </div>
  )
}
