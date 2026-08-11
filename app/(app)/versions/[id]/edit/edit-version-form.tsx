'use client'

import { useActionState, useState } from 'react'
import { updateVersion, type UpdateVersionState } from '@/app/actions/versions'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'

const initial: UpdateVersionState = {}

export type EditAppOption = { id: string; name: string }

export function EditVersionForm({
  versionId,
  today,
  initialName,
  initialDate,
  initialAppId,
  apps,
}: {
  versionId: string
  today: string
  initialName: string
  initialDate: string
  initialAppId: string
  apps: EditAppOption[]
}) {
  const [state, action, pending] = useActionState(updateVersion, initial)
  const [date, setDate] = useState(initialDate)

  // Porównanie stringów dat (bez new Date() w kliencie) — „dzisiaj" liczone
  // po stronie serwera i przekazane jako prop.
  const isPast = date !== '' && date < today

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="versionId" value={versionId} />

      <Field label="Nazwa wersji">
        <Input
          className="font-mono"
          name="name"
          defaultValue={initialName}
          required
        />
      </Field>

      <Field label="Data wydania">
        <Input
          className="font-mono"
          name="releaseDate"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <Field label="Aplikacja" optional>
        <Select name="applicationId" defaultValue={initialAppId}>
          <option value="">— brak —</option>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      {isPast && (
        <p role="status" className="text-sm text-warn-strong">
          Data wydania jest w przeszłości.
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </Button>
      </div>
    </form>
  )
}
