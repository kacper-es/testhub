import { prisma } from '@/lib/prisma'

// Bez tego Next próbowałby prerenderować stronę w czasie `next build`
// (warstwa builder, brak dostępu do bazy) i build by padł.
export const dynamic = 'force-dynamic'

export default async function HealthPage() {
  let ok = false
  try {
    await prisma.$queryRaw`SELECT 1`
    ok = true
  } catch {
    ok = false
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
      <h1>Health</h1>
      <p>Baza: {ok ? 'OK' : 'błąd'}</p>
    </main>
  )
}
