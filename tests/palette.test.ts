import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@prisma/client'

const jar = { set: vi.fn() }

vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { update: vi.fn() } } }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => jar) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { setPalette } from '@/app/actions/palette'
import { paletteAttr } from '@/lib/palette'

const user: User = {
  id: 'u1',
  email: 'x@example.com',
  passwordHash: 'hash',
  name: 'X',
  role: 'PM',
  isActive: true,
  mustChangePassword: false,
  theme: 'SYSTEM',
  palette: 'LIME',
  createdAt: new Date(),
}

function form(palette: string) {
  const f = new FormData()
  f.set('palette', palette)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSessionUser).mockResolvedValue(user)
})

describe('setPalette (UI-3)', () => {
  it('any role saves its own palette and mirrors it to the cookie', async () => {
    const res = await setPalette({}, form('COBALT'))
    expect(res).toEqual({ saved: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { palette: 'COBALT' },
    })
    expect(jar.set).toHaveBeenCalledWith('palette', 'COBALT', expect.any(Object))
  })

  it('unknown value → error, nothing saved', async () => {
    const res = await setPalette({}, form('RAINBOW'))
    expect(res).toEqual({ error: 'Nieznana paleta' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('not logged in → refused', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    await expect(setPalette({}, form('CYAN'))).rejects.toThrow()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})

describe('paletteAttr', () => {
  it('LIME and unknown values → no attribute (base tokens)', () => {
    expect(paletteAttr('LIME')).toBeUndefined()
    expect(paletteAttr(undefined)).toBeUndefined()
    expect(paletteAttr('<script>')).toBeUndefined()
  })
  it('known palettes → lowercase attribute', () => {
    expect(paletteAttr('MINT')).toBe('mint')
  })
})
