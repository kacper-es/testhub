import Link from 'next/link'
import type { User } from '@prisma/client'
import { logout } from '@/app/actions/auth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Card'
import { AppNav } from '@/components/nav/AppNav'
import { NavIcon } from '@/components/nav/NavIcon'
import { SidebarFrame } from '@/components/nav/SidebarFrame'
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
// UI-4: zwijana do wąskiego paska z ikonami (tylko desktop), stan w cookie.
const COLLAPSED_HIDE = 'lg:group-data-[collapsed=true]/sb:hidden'
const COLLAPSED_SR = 'lg:group-data-[collapsed=true]/sb:sr-only'

export function AppSidebar({
  user,
  openVersions,
  collapsed,
}: {
  user: Pick<User, 'name' | 'role' | 'theme'>
  openVersions: SidebarVersion[]
  collapsed: boolean
}) {
  return (
    <SidebarFrame initialCollapsed={collapsed}>
      <Link
        href="/"
        aria-label="Strona główna"
        className="flex items-center gap-2.5 rounded-[3px] lg:group-data-[collapsed=true]/sb:justify-center"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-signal font-mono text-xs font-bold text-pass-strong"
        >
          RH
        </span>
        <span className={cn('text-base font-semibold tracking-wide', COLLAPSED_SR)}>
          Release Hub
        </span>
      </Link>

      <AppNav isAdmin={user.role === 'ADMIN'} />

      {openVersions.length > 0 && (
        <div className={cn('hidden flex-col gap-3 lg:flex', COLLAPSED_HIDE)}>
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
        <div className={cn('lg:w-full', COLLAPSED_HIDE)}>
          <ThemeToggle current={user.theme} />
        </div>
        {/* UI-3: konto → ustawienia (motyw, paleta); nazwa skracana, bez poziomego scrolla */}
        <Link
          href="/settings"
          title="Ustawienia konta"
          className="flex min-w-0 items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-sm hover:bg-surface-raised lg:group-data-[collapsed=true]/sb:justify-center"
        >
          <span className="hidden text-muted lg:group-data-[collapsed=true]/sb:inline-flex">
            <NavIcon name="account" />
          </span>
          <span className={cn('min-w-0 truncate text-fg', COLLAPSED_SR)}>{user.name}</span>
          <span
            className={cn(
              'shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted',
              COLLAPSED_SR,
            )}
          >
            {user.role} ›
          </span>
        </Link>
        <form action={logout} className="lg:w-full">
          <Button
            variant="secondary"
            type="submit"
            title="Wyloguj"
            className="min-h-9 w-full gap-2 px-3 lg:group-data-[collapsed=true]/sb:px-0"
          >
            <span className="hidden lg:group-data-[collapsed=true]/sb:inline-flex">
              <NavIcon name="logout" />
            </span>
            <span className={COLLAPSED_SR}>Wyloguj</span>
          </Button>
        </form>
      </div>
    </SidebarFrame>
  )
}
