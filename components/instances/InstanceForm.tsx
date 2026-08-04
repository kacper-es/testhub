'use client'

import { useActionState } from 'react'
import type { InstanceFormState } from '@/app/actions/instances'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'

const initial: InstanceFormState = {}

export function InstanceForm({
  action,
  submitLabel,
  initialValues,
}: {
  action: (
    prev: InstanceFormState,
    formData: FormData,
  ) => Promise<InstanceFormState>
  submitLabel: string
  initialValues?: {
    id?: string
    name?: string
    clientName?: string | null
    keyFunctionalities?: string
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
          placeholder="Klient A — produkcja-mirror"
        />
      </Field>

      <Field label="Klient" optional>
        <Input
          name="clientName"
          defaultValue={initialValues?.clientName ?? ''}
          placeholder="Klient A"
        />
      </Field>

      <Field label="Kluczowe funkcjonalności">
        <Textarea
          name="keyFunctionalities"
          required
          rows={4}
          defaultValue={initialValues?.keyFunctionalities ?? ''}
          placeholder="Moduł płatności, integracja z ERP, raporty…"
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
