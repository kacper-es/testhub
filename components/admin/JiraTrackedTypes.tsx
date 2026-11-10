'use client'

import { useActionState } from 'react'
import { setJiraTrackedTypes, type JiraTrackedTypesState } from '@/app/actions/jira'
import { Button } from '@/components/ui/Button'

const initial: JiraTrackedTypesState = {}

// J-7: ADMIN picks the issue types shown separately in each version's Jira panel.
export function JiraTrackedTypes({
  options,
}: {
  options: { name: string; count: number; checked: boolean }[]
}) {
  const [state, action, pending] = useActionState(setJiraTrackedTypes, initial)

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted">
        Brak typów do wyboru — pojawią się po pierwszej synchronizacji ticketów.
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="m-0 grid gap-x-6 gap-y-1 border-0 p-0 sm:grid-cols-2 xl:grid-cols-3">
        <legend className="sr-only">Typy ticketów w podziale</legend>
        {options.map((o) => (
          <label
            key={o.name}
            className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[3px] px-2 text-sm hover:bg-surface-raised"
          >
            <input
              type="checkbox"
              name="types"
              value={o.name}
              defaultChecked={o.checked}
              className="h-4 w-4 accent-[var(--status-pass)]"
            />
            <span className="min-w-0 flex-1 truncate text-fg">{o.name}</span>
            <span className="font-mono text-xs text-muted">{o.count}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisuję…' : 'Zapisz typy'}
        </Button>
        {state.error && (
          <span role="alert" className="text-sm text-fail-strong">
            {state.error}
          </span>
        )}
        {state.saved && !pending && (
          <span role="status" className="text-sm text-muted">
            Zapisano.
          </span>
        )}
      </div>
    </form>
  )
}
