import { getSessionUser } from '@/lib/auth/session'
import { logout } from '@/app/actions/auth'

export default async function HomePage() {
  // Gwarantowane przez layout (app); użyte tu tylko do wyświetlenia danych.
  const user = await getSessionUser()

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
      <h1>Release Hub</h1>
      <p>
        Zalogowano jako <strong>{user?.name}</strong> ({user?.role}).
      </p>
      <form action={logout}>
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>
          Wyloguj
        </button>
      </form>
    </main>
  )
}
