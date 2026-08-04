'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Wordmark } from '@/components/Wordmark'

const initial: LoginState = {}

export function LoginForm({ changed }: { changed: boolean }) {
  const [state, action, pending] = useActionState(login, initial)

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <Wordmark subtitle="Hub przygotowania wydań" className="mb-6" />

        <div className="rounded-lg border border-border bg-surface p-6 shadow-md">
          <h1 className="mb-1 text-lg font-semibold">Logowanie</h1>
          <p className="mb-5 text-sm text-muted">
            Zaloguj się firmowym adresem email.
          </p>

          {changed && (
            <p
              role="status"
              className="mb-4 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-pass-strong"
            >
              Hasło zostało zmienione. Zaloguj się ponownie.
            </p>
          )}

          <form action={action} className="flex flex-col gap-4">
            <Field label="Email">
              <Input
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
              />
            </Field>

            <Field label="Hasło">
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            {state.error && (
              <p role="alert" className="text-sm text-fail-strong">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Logowanie…' : 'Zaloguj'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
