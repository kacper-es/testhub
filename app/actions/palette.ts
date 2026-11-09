'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/authz'
import { PALETTE_COOKIE } from '@/lib/palette'
import { paletteSchema } from '@/lib/validation/palette'
import { cookieSecure } from '@/lib/auth/cookie'

const ONE_YEAR_S = 60 * 60 * 24 * 365

export type SetPaletteState = { error?: string; saved?: boolean }

// UI-3: każdy zalogowany zmienia własną paletę. User.palette = źródło prawdy,
// cookie = mirror czytany w root layoucie (jak motyw).
export async function setPalette(_prev: SetPaletteState, formData: FormData): Promise<SetPaletteState> {
  const user = await requireUser()
  const parsed = paletteSchema.safeParse(formData.get('palette'))
  if (!parsed.success) return { error: 'Nieznana paleta' }

  await prisma.user.update({ where: { id: user.id }, data: { palette: parsed.data } })

  const jar = await cookies()
  jar.set(PALETTE_COOKIE, parsed.data, {
    httpOnly: false,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: ONE_YEAR_S,
  })
  revalidatePath('/', 'layout')
  return { saved: true }
}
