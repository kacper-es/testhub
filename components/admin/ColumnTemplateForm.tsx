'use client'

import { useActionState } from 'react'
import type { ColumnFormState } from '@/app/actions/columns'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'

const initial: ColumnFormState = {}

export type ColumnOption = { id: string; name: string }

export function ColumnTemplateForm({
  action,
  submitLabel,
  columns,
  initialValues,
}: {
  action: (
    prev: ColumnFormState,
    formData: FormData,
  ) => Promise<ColumnFormState>
  submitLabel: string
  columns: ColumnOption[]
  initialValues?: {
    id?: string
    name?: string
    isDefault?: boolean
    sortOrder?: number
    selectedIds?: string[]
  }
}) {
  const [state, formAction, pending] = useActionState(action, initial)
  const selected = new Set(initialValues?.selectedIds ?? [])

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {initialValues?.id && (
        <input type="hidden" name="id" value={initialValues.id} />
      )}

      <Field label="Nazwa szablonu">
        <Input
          name="name"
          required
          defaultValue={initialValues?.name ?? ''}
          placeholder="Domyślne flow"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={initialValues?.isDefault ?? false}
        />
        Domyślny (kroki podpinane przy tworzeniu nowej wersji)
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Kroki w szablonie</legend>
        {columns.length === 0 ? (
          <p className="text-sm text-muted">
            Brak aktywnych kroków — dodaj najpierw krok w zakładce „Kroki”.
          </p>
        ) : (
          columns.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="columnIds"
                value={c.id}
                defaultChecked={selected.has(c.id)}
              />
              {c.name}
            </label>
          ))
        )}
      </fieldset>

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
