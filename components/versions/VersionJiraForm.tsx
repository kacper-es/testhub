'use client'

import { useActionState } from 'react'
import { setVersionJiraVersion, type JiraMappingState } from '@/app/actions/jira'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Input'

const initial: JiraMappingState = {}

export type JiraVersionOption = {
  id: string
  label: string
}

export function VersionJiraForm({
  versionId,
  currentId,
  options,
}: {
  versionId: string
  currentId: string | null
  options: JiraVersionOption[]
}) {
  const [state, formAction, pending] = useActionState(setVersionJiraVersion, initial)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-3">
      <input type="hidden" name="versionId" value={versionId} />
      <Field label="Wersja Jira (fixVersion)">
        <Select name="jiraVersionId" defaultValue={currentId ?? ''}>
          <option value="">— niepodpięta —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
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
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz wersję Jira'}
        </Button>
      </div>
    </form>
  )
}
