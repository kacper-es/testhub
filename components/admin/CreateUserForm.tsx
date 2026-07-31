'use client'

import { useActionState } from 'react'
import { createUser, type UserFormState } from '@/app/actions/users'
import { Button } from '@/components/ui/Button'

const initial: UserFormState = {}

const field = 'flex flex-col gap-1'
const input =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg'

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initial)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <label className={field}>
        <span className="text-sm font-medium">Email (login)</span>
        <input
          className={`${input} font-mono`}
          name="email"
          type="email"
          required
          placeholder="jan.kowalski@releasehub.local"
        />
      </label>

      <label className={field}>
        <span className="text-sm font-medium">Imię i nazwisko</span>
        <input className={input} name="name" required placeholder="Jan Kowalski" />
      </label>

      <label className={field}>
        <span className="text-sm font-medium">Rola</span>
        <select name="role" required defaultValue="TESTER" className={input}>
          <option value="TESTER">Tester</option>
          <option value="PM">Product Manager (read-only)</option>
          <option value="ADMIN">Administrator</option>
        </select>
      </label>

      <label className={field}>
        <span className="text-sm font-medium">Hasło tymczasowe</span>
        <input
          className={input}
          name="password"
          type="text"
          required
          minLength={8}
          placeholder="min. 8 znaków"
        />
        <span className="text-xs text-muted">
          Użytkownik zmieni je przy pierwszym logowaniu.
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-fail-strong">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Tworzenie…' : 'Utwórz konto'}
        </Button>
      </div>
    </form>
  )
}
