'use client'

import { useActionState } from 'react'
import { syncVersionJiraIssues, type JiraSyncState } from '@/app/actions/jira'
import { Button } from '@/components/ui/Button'

const initial: JiraSyncState = { status: 'idle' }

// „Synchronizuj teraz" (J-3, ADMIN). Stan ostatniej synchronizacji liczony na
// serwerze i podany gotowym tekstem (bez dat po stronie klienta).
export function VersionJiraSync({
  versionId,
  lastSync,
}: {
  versionId: string
  lastSync: string | null
}) {
  const [state, action, pending] = useActionState(syncVersionJiraIssues, initial)

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="versionId" value={versionId} />
      <p className="text-sm text-muted">
        {lastSync ?? 'Tickety nie były jeszcze synchronizowane.'}
      </p>
      <div>
        <Button variant="secondary" type="submit" disabled={pending}>
          {pending ? 'Synchronizuję…' : 'Synchronizuj teraz'}
        </Button>
      </div>
      {state.status === 'ok' && (
        <p role="status" className="text-sm text-pass-strong">
          Zsynchronizowano: {state.total} ticketów, {state.done} gotowych
          {state.removed > 0 ? `, ${state.removed} wyjętych z wersji` : ''}.
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}
    </form>
  )
}
