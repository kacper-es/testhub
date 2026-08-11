'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buildBreadcrumbs } from '@/lib/nav'

// Okruszki wyliczane ze ścieżki. Nie renderują się na dashboardzie (pusta lista).
export function Breadcrumbs() {
  const pathname = usePathname()
  const crumbs = buildBreadcrumbs(pathname)
  if (crumbs.length === 0) return null

  return (
    <nav
      aria-label="Ścieżka nawigacji"
      className="mx-auto w-full max-w-6xl px-6 pt-4"
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="select-none">
                  /
                </span>
              )}
              {crumb.href && !last ? (
                <Link href={crumb.href} className="hover:text-fg hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={last ? 'text-fg' : undefined}
                  aria-current={last ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
