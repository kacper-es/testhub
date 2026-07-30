'use client'

import { useActionState } from 'react'
import { changePassword, type ChangePasswordState } from '@/app/actions/auth'

const initial: ChangePasswordState = {}

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

export function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const [state, action, pending] = useActionState(changePassword, initial)

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Zmiana hasła</h1>

      {mustChange && (
        <p role="status" style={{ marginBottom: '1rem' }}>
          Musisz zmienić hasło tymczasowe, zanim przejdziesz dalej.
        </p>
      )}

      <form action={action}>
        <label style={field}>
          Obecne hasło
          <input
            style={input}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        <label style={field}>
          Nowe hasło
          <input
            style={input}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>

        <label style={field}>
          Powtórz nowe hasło
          <input
            style={input}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
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
          {pending ? 'Zapisywanie…' : 'Zmień hasło'}
        </button>
      </form>
    </main>
  )
}
