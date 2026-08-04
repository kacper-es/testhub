'use client'

import { useActionState } from 'react'
import { resetUserPassword, type UserFormState } from '@/app/actions/users'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'

const initial: UserFormState = {}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetUserPassword, initial)

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-2">
      <input type="hidden" name="id" value={userId} />
      <Field
        label="Nowe hasło tymczasowe"
        hint="Reset wyloguje użytkownika ze wszystkich sesji i wymusi zmianę hasła przy następnym logowaniu."
      >
        <Input
          name="password"
          type="text"
          required
          minLength={8}
          placeholder="min. 8 znaków"
        />
      </Field>
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
