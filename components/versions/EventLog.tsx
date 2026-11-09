import Link from 'next/link'
import { Card, Eyebrow } from '@/components/ui/Card'

export type EventLogEntry = {
  id: string
  when: string // formatted on the server
  user: string
  text: string
}

// UI-2b: ostatnie wpisy ChangeLog tej wersji, w stylu logu terminala.
export function EventLog({
  entries,
  fullLogHref,
}: {
  entries: EventLogEntry[]
  fullLogHref: string | null
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0">
          <Eyebrow>Log zdarzeń</Eyebrow>
        </h2>
        {fullLogHref && (
          <Link
            href={fullLogHref}
            className="font-mono text-[11px] text-muted underline underline-offset-2 hover:text-fg"
          >
            cały log
          </Link>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Brak zmian w tej wersji.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0 font-mono text-xs">
          {entries.map((e) => (
            <li key={e.id} className="grid grid-cols-[4.5rem_1fr] gap-2">
              <span className="text-muted">{e.when}</span>
              <span className="min-w-0 break-words text-fg">
                <span className="text-muted">{e.user} · </span>
                {e.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
