import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/cookie'

// Lekka brama na Edge: decyduje wyłącznie na podstawie OBECNOŚCI cookie sesji.
// Pełna walidacja (podpis, wygaśnięcie, isActive) oraz redirect przy
// `mustChangePassword` dzieje się server-side (getSessionUser + layout (app)),
// bo Prisma nie działa w runtime Edge.
const PUBLIC_PATHS = ['/login', '/health']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
}

const EIGHT_HOURS_S = 8 * 60 * 60

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const cookie = req.cookies.get(SESSION_COOKIE)

  if (!cookie) {
    if (isPublic(pathname)) return NextResponse.next()
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Cookie obecne — przepuść i przesuń ważność cookie (rolling refresh na
  // poziomie przeglądarki). "Już zalogowany na /login" rozstrzyga strona
  // /login server-side (może to być nieważne cookie — nie robimy pętli).
  const res = NextResponse.next()
  res.cookies.set(SESSION_COOKIE, cookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: EIGHT_HOURS_S,
  })
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
