// Konfiguracja nawigacji i budowa okruszków. Czysty moduł (bez next/headers,
// bez Prismy) — używany przez komponenty klienckie (AppNav, Breadcrumbs).

export type NavItem = {
  href: string
  label: string
  adminOnly?: boolean
}

// Główna nawigacja w pasku — krótkie etykiety.
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/versions', label: 'Wersje' },
  { href: '/instances', label: 'Instancje' },
  { href: '/archive', label: 'Archiwum' },
  { href: '/admin', label: 'Admin', adminOnly: true },
]

// Sekcja aktywna: dokładne trafienie dla dashboardu, prefiks dla pozostałych.
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Etykiety znanych, statycznych segmentów ścieżki (opisowe — jak dawne back-linki).
const SEGMENT_LABELS: Record<string, string> = {
  versions: 'Wersje',
  instances: 'Katalog instancji',
  archive: 'Archiwum',
  admin: 'Panel administratora',
  templates: 'Szablony zadań',
  users: 'Konta',
  applications: 'Aplikacje',
  changelog: 'Log zmian',
  new: 'Nowa',
  edit: 'Edycja',
}

export type Crumb = { label: string; href?: string }

// Okruszki wyliczane wyłącznie ze ścieżki (zero propsów per strona).
// Segment dynamiczny (id) dostaje generyczne słowo i tylko gdy jest ostatni;
// pośredni segment dynamiczny (np. templates/[id]/edit) jest pomijany.
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const clean = pathname.replace(/\/+$/, '')
  if (clean === '' || clean === '/') return [] // brak okruszków na dashboardzie

  const segments = clean.split('/').filter(Boolean)
  const crumbs: Crumb[] = [{ label: 'Dashboard', href: '/' }]

  let acc = ''
  segments.forEach((seg, i) => {
    acc += `/${seg}`
    const isLast = i === segments.length - 1
    const known = SEGMENT_LABELS[seg]
    if (known) {
      crumbs.push({ label: known, href: isLast ? undefined : acc })
    } else if (isLast) {
      crumbs.push({ label: 'Szczegóły' })
    }
  })

  return crumbs
}
