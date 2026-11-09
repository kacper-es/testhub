import { prisma } from '@/lib/prisma'

// Public health check for Swarm / HAProxy (no requireRole on purpose — no data,
// only DB reachability). 200 when the database answers, 503 otherwise.
// The body keeps "OK</p>" so the old body-grep healthcheck in existing stacks still works.
export const dynamic = 'force-dynamic'

export async function GET() {
  let ok = false
  try {
    await prisma.$queryRaw`SELECT 1`
    ok = true
  } catch {
    ok = false
  }
  return new Response(`<!doctype html><title>Health</title><p>Baza: ${ok ? 'OK' : 'błąd'}</p>\n`, {
    status: ok ? 200 : 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
