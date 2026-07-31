'use client'

import { useActionState, useState } from 'react'
import { createVersion, type CreateVersionState } from '@/app/actions/versions'
import { Button } from '@/components/ui/Button'

const initial: CreateVersionState = {}

const field = 'flex flex-col gap-1'
const input =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg'

export function NewVersionForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(createVersion, initial)
  const [date, setDate] = useState('')

  // Porównanie stringów dat (bez new Date() w kliencie) — „dzisiaj" liczone
  // po stronie serwera i przekazane jako prop.
  const isPast = date !== '' && date < today

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      <label className={field}>
        <span className="text-sm font-medium">Nazwa wersji</span>
        <input
          className={`${input} font-mono`}
          name="name"
          placeholder="2.4.1"
          required
        />
      </label>

      <label className={field}>
        <span className="text-sm font-medium">Data wydania</span>
        <input
          className={`${input} font-mono`}
          name="releaseDate"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      {isPast && (
        <p role="status" className="text-sm text-warn-strong">
          Data wydania jest w przeszłości — wersja zostanie utworzona jako
          backfill starego wydania.
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Tworzenie…' : 'Utwórz wersję'}
        </Button>
      </div>
    </form>
  )
}
