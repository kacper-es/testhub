import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/authz'
import { todayInWarsaw } from '@/lib/date'
import { daysRemaining, toDateOnly, urgency } from '@/lib/versions/deadline'
import { AppSidebar, type SidebarVersion } from '@/components/nav/AppSidebar'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'

const SIDEBAR_VERSIONS = 8

// Strażnik zalogowanej części aplikacji. Middleware sprawdza tylko obecność
// cookie; tu jest pełna walidacja sesji i brama `mustChangePassword`.
// Layout dostarcza też wspólny chrome (boczna kolumna + okruszki) dla każdej strony.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  if (user.mustChangePassword) redirect('/change-password')

  // Otwarte wersje do kolumny bocznej — T−N liczone na serwerze (reguła 25).
  const today = todayInWarsaw()
  const open = await prisma.version.findMany({
    where: { status: 'IN_PROGRESS' },
    orderBy: { releaseDate: 'asc' },
    take: SIDEBAR_VERSIONS,
    select: { id: true, name: true, releaseDate: true },
  })
  const openVersions: SidebarVersion[] = open.map((v) => {
    const daysLeft = daysRemaining(toDateOnly(v.releaseDate), today)
    return { id: v.id, name: v.name, daysLeft, level: urgency(daysLeft).level }
  })

  return (
    <div className="min-h-screen lg:flex">
      <AppSidebar user={user} openVersions={openVersions} />
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
        {children}
      </div>
    </div>
  )
}
