'use client'

import { useActionState } from 'react'
import { testJiraConnection, type JiraTestState } from '@/app/actions/jira'
import { Button } from '@/components/ui/Button'

const initial: JiraTestState = { status: 'idle' }

export function JiraConnectionTest({ disabled }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(testJiraConnection, initial)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <Button type="submit" variant="secondary" disabled={disabled || pending}>
          {pending ? 'Łączenie…' : 'Testuj połączenie'}
        </Button>
      </div>
      <div aria-live="polite">
        {state.status === 'ok' && (
          <p className="text-sm text-pass-strong">
            Połączono jako <strong>{state.displayName}</strong> ({state.baseUrl}) w{' '}
            {state.latencyMs} ms.
          </p>
        )}
        {state.status === 'error' && (
          <p role="alert" className="text-sm text-fail-strong">
            {state.error}
          </p>
        )}
      </div>
    </form>
  )
}
