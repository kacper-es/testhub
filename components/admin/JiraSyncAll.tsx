'use client'

import { useActionState } from 'react'
import { syncAllOpenJiraVersions, type JiraSyncAllState } from '@/app/actions/jira'
import { Button } from '@/components/ui/Button'

const initial: JiraSyncAllState = { status: 'idle' }

// „Synchronizuj wszystkie otwarte wersje" (J-3, ADMIN) — wynik per wersja.
export function JiraSyncAll({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(syncAllOpenJiraVersions, initial)

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <Button variant="secondary" type="submit" disabled={disabled || pending}>
          {pending ? 'Synchronizuję…' : 'Synchronizuj wszystkie otwarte wersje'}
        </Button>
      </div>
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}
      {state.status === 'done' && state.results.length === 0 && (
        <p role="status" className="text-sm text-muted">
          Żadna otwarta wersja nie jest podpięta do wersji Jira.
        </p>
      )}
      {state.status === 'done' && state.results.length > 0 && (
        <ul role="status" className="flex flex-col gap-1 text-sm">
          {state.results.map((r) => (
            <li key={r.name}>
              <span className="font-mono">{r.name}</span>:{' '}
              <span className={r.ok ? 'text-pass-strong' : 'text-fail-strong'}>
                {r.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
