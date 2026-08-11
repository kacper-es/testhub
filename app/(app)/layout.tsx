import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/authz'
import { AppHeader } from '@/components/nav/AppHeader'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'

// Strażnik zalogowanej części aplikacji. Middleware sprawdza tylko obecność
// cookie; tu jest pełna walidacja sesji i brama `mustChangePassword`.
// Layout dostarcza też wspólny chrome (pasek + okruszki) dla każdej strony.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  if (user.mustChangePassword) redirect('/change-password')

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <Breadcrumbs />
      {children}
    </div>
  )
}
