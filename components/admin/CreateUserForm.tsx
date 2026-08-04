'use client'

import { useActionState } from 'react'
import { createUser, type UserFormState } from '@/app/actions/users'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'

const initial: UserFormState = {}

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initial)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Email (login)">
        <Input
          className="font-mono"
          name="email"
          type="email"
          required
          placeholder="jan.kowalski@releasehub.local"
        />
      </Field>

      <Field label="Imię i nazwisko">
        <Input name="name" required placeholder="Jan Kowalski" />
      </Field>

      <Field label="Rola">
        <Select name="role" required defaultValue="TESTER">
          <option value="TESTER">Tester</option>
          <option value="PM">Product Manager (read-only)</option>
          <option value="ADMIN">Administrator</option>
        </Select>
      </Field>

      <Field
        label="Hasło tymczasowe"
        hint="Użytkownik zmieni je przy pierwszym logowaniu."
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
        <Button type="submit" disabled={pending}>
          {pending ? 'Tworzenie…' : 'Utwórz konto'}
        </Button>
      </div>
    </form>
  )
}
