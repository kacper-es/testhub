'use client'

import { useActionState } from 'react'
import { changePassword, type ChangePasswordState } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Wordmark } from '@/components/Wordmark'

const initial: ChangePasswordState = {}

export function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const [state, action, pending] = useActionState(changePassword, initial)

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <Wordmark subtitle="Hub przygotowania wydań" className="mb-6" />

        <div className="rounded-lg border border-border bg-surface p-6 shadow-md">
          <h1 className="mb-1 text-lg font-semibold">Zmiana hasła</h1>

          {mustChange ? (
            <p
              role="status"
              className="mb-5 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-warn-strong"
            >
              Musisz zmienić hasło tymczasowe, zanim przejdziesz dalej.
            </p>
          ) : (
            <p className="mb-5 text-sm text-muted">
              Ustaw nowe hasło do swojego konta.
            </p>
          )}

          <form action={action} className="flex flex-col gap-4">
            <Field label="Obecne hasło">
              <Input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            <Field label="Nowe hasło">
              <Input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>

            <Field label="Powtórz nowe hasło">
              <Input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>

            {state.error && (
              <p role="alert" className="text-sm text-fail-strong">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Zapisywanie…' : 'Zmień hasło'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
