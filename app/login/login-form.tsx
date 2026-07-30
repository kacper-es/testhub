'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/app/actions/auth'

const initial: LoginState = {}

const wrap: React.CSSProperties = {
  maxWidth: 360,
  margin: '4rem auto',
  padding: '0 1rem',
  fontFamily: 'sans-serif',
}
const field: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  marginBottom: '1rem',
}
const input: React.CSSProperties = {
  padding: '0.5rem',
  fontSize: '1rem',
  border: '1px solid #ccc',
  borderRadius: 4,
}

export function LoginForm({ changed }: { changed: boolean }) {
  const [state, action, pending] = useActionState(login, initial)

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        Release Hub — logowanie
      </h1>

      {changed && (
        <p role="status" style={{ marginBottom: '1rem' }}>
          Hasło zostało zmienione. Zaloguj się ponownie.
        </p>
      )}

      <form action={action}>
        <label style={field}>
          Email
          <input
            style={input}
            name="email"
            type="email"
            autoComplete="username"
            required
          />
        </label>

        <label style={field}>
          Hasło
          <input
            style={input}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        {state.error && (
          <p role="alert" style={{ marginBottom: '1rem' }}>
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
        >
          {pending ? 'Logowanie…' : 'Zaloguj'}
        </button>
      </form>
    </main>
  )
}
