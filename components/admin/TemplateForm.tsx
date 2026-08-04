'use client'

import { useActionState, useState } from 'react'
import type { DeadlineType, TaskType } from '@prisma/client'
import type { TemplateFormState } from '@/app/actions/task-templates'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'

const initial: TemplateFormState = {}

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  CHECKBOX: 'Checkbox — ręczny status',
  TICKET_AGGREGATE: 'Licznik ticketów — status z X/Y',
  INSTANCE_AGGREGATE: 'Agregat instancji — status wyliczany',
}

export function TemplateForm({
  action,
  submitLabel,
  initialValues,
  lockedTaskType,
}: {
  action: (
    prev: TemplateFormState,
    formData: FormData,
  ) => Promise<TemplateFormState>
  submitLabel: string
  initialValues?: {
    id?: string
    name?: string
    description?: string | null
    taskType?: TaskType
    deadlineType?: DeadlineType
    daysBeforeRelease?: number | null
    sortOrder?: number
  }
  // Ustawione przy edycji — taskType jest niezmienny (reguła 7).
  lockedTaskType?: TaskType
}) {
  const [state, formAction, pending] = useActionState(action, initial)
  const [deadlineType, setDeadlineType] = useState<DeadlineType>(
    initialValues?.deadlineType ?? 'FLEXIBLE',
  )

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
          placeholder="Release notes dla klienta"
        />
      </Field>

      <Field label="Opis" optional>
        <Textarea
          name="description"
          rows={3}
          defaultValue={initialValues?.description ?? ''}
        />
      </Field>

      {lockedTaskType ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Typ zadania</span>
          <div className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
            {TASK_TYPE_LABEL[lockedTaskType]}
          </div>
          <p className="text-xs text-muted">
            Typ zadania jest niezmienny. Aby go zmienić — dezaktywuj szablon i
            utwórz nowy.
          </p>
        </div>
      ) : (
        <Field label="Typ zadania">
          <Select
            name="taskType"
            required
            defaultValue={initialValues?.taskType ?? 'CHECKBOX'}
          >
            {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Termin">
        <Select
          name="deadlineType"
          value={deadlineType}
          onChange={(e) => setDeadlineType(e.target.value as DeadlineType)}
        >
          <option value="FLEXIBLE">Elastyczny (bez terminu)</option>
          <option value="DAYS_BEFORE_RELEASE">Dni przed wydaniem</option>
        </Select>
      </Field>

      {deadlineType === 'DAYS_BEFORE_RELEASE' && (
        <Field label="Dni przed wydaniem">
          <Input
            className="font-mono"
            name="daysBeforeRelease"
            type="number"
            min={0}
            defaultValue={initialValues?.daysBeforeRelease ?? ''}
          />
        </Field>
      )}

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
