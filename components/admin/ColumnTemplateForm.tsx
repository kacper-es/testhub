'use client'

import { useActionState, useMemo, useState } from 'react'
import type { ColumnFormState } from '@/app/actions/columns'
import { SortableList, DragHandle } from '@/components/ui/SortableList'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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

  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  // Wybrane kroki w kolejności (drag zmienia kolejność, w jakiej trafią do wersji).
  const [selected, setSelected] = useState<string[]>(
    (initialValues?.selectedIds ?? []).filter((id) => byId.has(id)),
  )
  const selectedItems = selected
    .map((id) => byId.get(id))
    .filter((c): c is ColumnOption => c !== undefined)
  const available = columns.filter((c) => !selected.includes(c.id))

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {initialValues?.id && (
        <input type="hidden" name="id" value={initialValues.id} />
      )}
      {/* Wybrane kroki w kolejności — źródło prawdy dla akcji. */}
      {selected.map((id) => (
        <input key={id} type="hidden" name="columnIds" value={id} />
      ))}

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

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Kroki w szablonie</span>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-muted">
            Brak kroków — dodaj poniżej. Kolejność ustawisz przeciąganiem{' '}
            <span aria-hidden>⠿</span>.
          </p>
        ) : (
          <SortableList
            items={selectedItems}
            onReorder={setSelected}
            renderItem={(item, handle) => (
              <Card className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2">
                  <DragHandle handle={handle} />
                  <span className="text-fg">{item.name}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-fail-strong"
                  onClick={() =>
                    setSelected((s) => s.filter((id) => id !== item.id))
                  }
                >
                  Usuń
                </Button>
              </Card>
            )}
          />
        )}
      </div>

      {available.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
          <span className="text-sm font-medium">Dodaj krok do szablonu</span>
          <div className="flex flex-wrap gap-2">
            {available.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="secondary"
                onClick={() => setSelected((s) => [...s, c.id])}
              >
                + {c.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Field label="Kolejność szablonu na liście">
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
