'use client'

import { useActionState } from 'react'
import type { ApplicationFormState } from '@/app/actions/applications'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'

const initial: ApplicationFormState = {}

export function ApplicationForm({
  action,
  submitLabel,
  initialValues,
}: {
  action: (
    prev: ApplicationFormState,
    formData: FormData,
  ) => Promise<ApplicationFormState>
  submitLabel: string
  initialValues?: {
    id?: string
    name?: string
    sortOrder?: number
  }
}) {
  const [state, formAction, pending] = useActionState(action, initial)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {initialValues?.id && (
        <input type="hidden" name="id" value={initialValues.id} />
      )}

      <Field label="Nazwa">
        <Input
          name="name"
          required
          defaultValue={initialValues?.name ?? ''}
          placeholder="Portal klienta"
        />
      </Field>

      <Field label="Kolejność">
        <Input
          className="font-mono"
          name="sortOrder"
          type="number"
          required
          defaultValue={initialValues?.sortOrder ?? 0}
        />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisywanie…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
