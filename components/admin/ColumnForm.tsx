'use client'

import { useActionState } from 'react'
import type { ColumnFieldType } from '@prisma/client'
import type { ColumnFormState } from '@/app/actions/columns'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'

const initial: ColumnFormState = {}

// Etykiety typów pól. Na start tylko checkbox; kolejne dojdą tutaj i do enuma.
export const FIELD_TYPE_LABEL: Record<ColumnFieldType, string> = {
  CHECKBOX: 'Checkbox — zaznaczenie tak/nie',
}

export function ColumnForm({
  action,
  submitLabel,
  initialValues,
}: {
  action: (
    prev: ColumnFormState,
    formData: FormData,
  ) => Promise<ColumnFormState>
  submitLabel: string
  initialValues?: {
    id?: string
    name?: string
    fieldType?: ColumnFieldType
  }
}) {
  const [state, formAction, pending] = useActionState(action, initial)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {initialValues?.id && (
        <input type="hidden" name="id" value={initialValues.id} />
      )}

      <Field label="Nazwa kroku">
        <Input
          name="name"
          required
          defaultValue={initialValues?.name ?? ''}
          placeholder="Środowisko odtworzone"
        />
      </Field>

      <Field label="Typ pola">
        <Select
          name="fieldType"
          required
          defaultValue={initialValues?.fieldType ?? 'CHECKBOX'}
        >
          {(Object.keys(FIELD_TYPE_LABEL) as ColumnFieldType[]).map((t) => (
            <option key={t} value={t}>
              {FIELD_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
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
