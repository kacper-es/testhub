'use client'

import { useActionState, useState } from 'react'
import { deleteVersion, type DeleteVersionState } from '@/app/actions/versions'
import { Button } from '@/components/ui/Button'

const initial: DeleteVersionState = {}

// Trwałe usunięcie wersji (ADMIN). Przycisk aktywny dopiero po wpisaniu nazwy;
// serwer sprawdza nazwę ponownie.
export function DeleteVersion({
  versionId,
  versionName,
}: {
  versionId: string
  versionName: string
}) {
  const [state, action, pending] = useActionState(deleteVersion, initial)
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === versionName

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="versionId" value={versionId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">
          Wpisz <span className="font-mono text-fg">{versionName}</span>, aby potwierdzić
        </span>
        <input
          name="confirmName"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="rounded-[3px] border border-border-strong bg-bg px-3 py-2 text-sm text-fg"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}
      <div>
        <Button variant="danger" type="submit" disabled={!matches || pending}>
          Usuń wersję na stałe
        </Button>
      </div>
    </form>
  )
}
