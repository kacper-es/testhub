import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  mono?: boolean
}

// Na wąskim ekranie tabela przechodzi w karty (sekcja 9.4), bez poziomego scrolla.
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty = 'Brak danych',
}: {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  empty?: ReactNode
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>
  }

  return (
    <div>
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-semibold text-muted">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-border">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn('px-3 py-2 text-fg', c.mono && 'font-mono')}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={getRowKey(row)}
            className="rounded-lg border border-border bg-surface p-3"
          >
            {columns.map((c) => (
              <div key={c.key} className="flex justify-between gap-3 py-1">
                <span className="text-xs font-semibold text-muted">
                  {c.header}
                </span>
                <span
                  className={cn(
                    'text-right text-sm text-fg',
                    c.mono && 'font-mono',
                  )}
                >
                  {c.render(row)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
