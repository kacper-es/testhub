import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'

// Strażnik zalogowanej części aplikacji. Middleware sprawdza tylko obecność
// cookie; tu jest pełna walidacja sesji i brama `mustChangePassword`.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (user.mustChangePassword) redirect('/change-password')

  return <>{children}</>
}
