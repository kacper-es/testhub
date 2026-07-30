import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/authz'

// Strażnik zalogowanej części aplikacji. Middleware sprawdza tylko obecność
// cookie; tu jest pełna walidacja sesji i brama `mustChangePassword`.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  if (user.mustChangePassword) redirect('/change-password')

  return <>{children}</>
}
