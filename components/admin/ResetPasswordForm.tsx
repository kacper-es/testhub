'use client'

import { useActionState } from 'react'
import { resetUserPassword, type UserFormState } from '@/app/actions/users'
import { Button } from '@/components/ui/Button'

const initial: UserFormState = {}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetUserPassword, initial)

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-2">
      <input type="hidden" name="id" value={userId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nowe hasło tymczasowe</span>
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
          name="password"
          type="text"
          required
          minLength={8}
          placeholder="min. 8 znaków"
        />
      </label>
      <span className="text-xs text-muted">
        Reset wyloguje użytkownika ze wszystkich sesji i wymusi zmianę hasła przy
        następnym logowaniu.
      </span>
      {state.error && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Resetowanie…' : 'Zresetuj hasło'}
        </Button>
      </div>
    </form>
  )
}
