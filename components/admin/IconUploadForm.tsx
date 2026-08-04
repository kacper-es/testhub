'use client'

import { useActionState } from 'react'
import {
  uploadApplicationIcon,
  type ApplicationFormState,
} from '@/app/actions/applications'
import { ICON_ACCEPT } from '@/lib/validation/application'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Input'

const initial: ApplicationFormState = {}

export function IconUploadForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(uploadApplicationIcon, initial)

  return (
    <form action={action} className="flex max-w-lg flex-col gap-3">
      <input type="hidden" name="id" value={id} />

      <Field
        label="Nowy plik ikony"
        hint="PNG, WebP lub JPEG, do 100 KB. Ikona skaluje się do wielkości nazwy wersji."
      >
        <input
          type="file"
          name="icon"
          accept={ICON_ACCEPT}
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1 file:text-sm file:text-fg"
        />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Wgrywanie…' : 'Wgraj ikonę'}
        </Button>
      </div>
    </form>
  )
}
