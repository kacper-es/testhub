import Link from 'next/link'
import type { User } from '@prisma/client'
import { logout } from '@/app/actions/auth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Card'
import { AppNav } from '@/components/nav/AppNav'
import { cn } from '@/lib/cn'

export type SidebarVersion = {
  id: string
  name: string
  daysLeft: number // computed server-side (rule 25)
  level: 'pass' | 'warn' | 'fail'
}

const LEVEL_TEXT = {
  pass: 'text-muted',
  warn: 'text-warn-strong',
  fail: 'text-fail-strong',
} as const

// UI-2a: boczna kolumna (desktop, przyklejona na wysokość ekranu) / pasek u góry
// (telefon). Marka, nawigacja, otwarte wersje z odliczaniem T−N, motyw i konto.
export function AppSidebar({
  user,
  openVersions,
}: {
  user: Pick<User, 'name' | 'role' | 'theme'>
  openVersions: SidebarVersion[]
}) {
  return (
    <aside className="z-40 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-bg px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-7 lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
      <Link href="/" aria-label="Strona główna" className="flex items-center gap-2.5 rounded-[3px]">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-signal font-mono text-xs font-bold text-pass-strong"
        >
          RH
        </span>
        <span className="text-base font-semibold tracking-wide">Release Hub</span>
      </Link>

      <AppNav isAdmin={user.role === 'ADMIN'} />

      {openVersions.length > 0 && (
        <div className="hidden flex-col gap-3 lg:flex">
          <Eyebrow>Otwarte wersje</Eyebrow>
          <ul className="flex flex-col gap-1 font-mono text-[13px]">
            {openVersions.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/versions/${v.id}`}
                  className="flex items-center justify-between gap-3 rounded-[3px] px-2 py-1.5 hover:bg-surface-raised"
                >
                  <span className="truncate text-fg">{v.name}</span>
                  <span className={cn('shrink-0', LEVEL_TEXT[v.level])}>
                    {v.daysLeft < 0 ? `T+${-v.daysLeft}` : `T−${v.daysLeft}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2 lg:ml-0 lg:mt-auto lg:flex-col lg:flex-nowrap lg:items-stretch">
        <ThemeToggle current={user.theme} />
        {/* UI-3: konto → ustawienia (motyw, paleta); nazwa skracana, bez poziomego scrolla */}
        <Link
          href="/settings"
          title="Ustawienia konta"
          className="flex min-w-0 items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-sm hover:bg-surface-raised"
        >
          <span className="min-w-0 truncate text-fg">{user.name}</span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted">
            {user.role} ›
          </span>
        </Link>
        <form action={logout} className="lg:w-full">
          <Button variant="secondary" type="submit" className="min-h-9 w-full px-3">
            Wyloguj
          </Button>
        </form>
      </div>
    </aside>
  )
}
