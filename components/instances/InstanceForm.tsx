'use client'

import { useActionState } from 'react'
import type { InstanceFormState } from '@/app/actions/instances'
import { Button } from '@/components/ui/Button'

const initial: InstanceFormState = {}

const field = 'flex flex-col gap-1'
const input =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg'

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

      <label className={field}>
        <span className="text-sm font-medium">Nazwa</span>
        <input
          className={input}
          name="name"
          required
          defaultValue={initialValues?.name ?? ''}
          placeholder="Klient A — produkcja-mirror"
        />
      </label>

      <label className={field}>
        <span className="text-sm font-medium">
          Klient <span className="text-muted">(opcjonalnie)</span>
        </span>
        <input
          className={input}
          name="clientName"
          defaultValue={initialValues?.clientName ?? ''}
          placeholder="Klient A"
        />
      </label>

      <label className={field}>
        <span className="text-sm font-medium">Kluczowe funkcjonalności</span>
        <textarea
          className={input}
          name="keyFunctionalities"
          required
          rows={4}
          defaultValue={initialValues?.keyFunctionalities ?? ''}
          placeholder="Moduł płatności, integracja z ERP, raporty…"
        />
      </label>

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
