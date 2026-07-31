'use server'

import { cookies } from 'next/headers'
import type { Theme } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/authz'
import { THEME_COOKIE } from '@/lib/theme'

const ONE_YEAR_S = 60 * 60 * 24 * 365

export async function setTheme(theme: Theme): Promise<void> {
  const user = await requireUser()

  // User.theme = źródło prawdy; cookie = mirror czytany w server layoucie.
  await prisma.user.update({ where: { id: user.id }, data: { theme } })

  const jar = await cookies()
  jar.set(THEME_COOKIE, theme, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_S,
  })
}
