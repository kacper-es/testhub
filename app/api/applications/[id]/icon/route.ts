import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/authz'

// Read-only serwowanie ikony aplikacji (nie mutacja → route handler dozwolony).
// Bajty trzymane w bazie; cache-busting po stronie wywołującego przez ?v=<ts>.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser()
  const { id } = await params

  const app = await prisma.application.findUnique({
    where: { id },
    select: { iconData: true, iconType: true },
  })
  if (!app?.iconData || !app.iconType) {
    return new NextResponse('Brak ikony', { status: 404 })
  }

  return new NextResponse(new Uint8Array(app.iconData), {
    status: 200,
    headers: {
      'Content-Type': app.iconType,
      // Ikona wgrana przez użytkownika — blokada sniffowania typu.
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
