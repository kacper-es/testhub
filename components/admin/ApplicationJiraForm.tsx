'use client'

import { useActionState } from 'react'
import { setApplicationJiraProject, type JiraMappingState } from '@/app/actions/jira'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'

const initial: JiraMappingState = {}

export function ApplicationJiraForm({
  applicationId,
  projectKey,
  disabled,
}: {
  applicationId: string
  projectKey: string | null
  disabled?: boolean
}) {
  const [state, formAction, pending] = useActionState(setApplicationJiraProject, initial)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Field
        label="Klucz projektu Jira"
        hint="Np. ABC. Puste pole = aplikacja niepodpięta do Jiry. Klucz jest sprawdzany w Jirze przy zapisie."
      >
        <Input
          className="font-mono uppercase"
          name="projectKey"
          defaultValue={projectKey ?? ''}
          placeholder="ABC"
          autoComplete="off"
          disabled={disabled}
        />
      </Field>
      <div aria-live="polite">
        {state.error && (
          <p role="alert" className="text-sm text-fail-strong">
            {state.error}
          </p>
        )}
        {state.saved && !pending && <p className="text-sm text-pass-strong">Zapisano.</p>}
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={disabled || pending}>
          {pending ? 'Sprawdzanie w Jirze…' : 'Zapisz projekt Jira'}
        </Button>
      </div>
    </form>
  )
}
