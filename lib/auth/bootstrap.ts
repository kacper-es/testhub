import { Prisma, type PrismaClient } from '@prisma/client'
import { hashPassword } from '@/lib/auth/password'

// Default account for a fresh install (Grafana-style). Publicly known on purpose:
// mustChangePassword forces a new password on first login.
export const INITIAL_ADMIN_EMAIL = 'admin@example.com'
export const INITIAL_ADMIN_PASSWORD = 'admin'

type Db = Pick<PrismaClient, 'user'>

export type BootstrapResult = 'created' | 'skipped'

// Creates the initial ADMIN only when the User table is completely empty
// (inactive accounts count too — deactivating everyone never resurrects it).
export async function ensureInitialAdmin(db: Db): Promise<BootstrapResult> {
  if ((await db.user.count()) > 0) return 'skipped'

  const passwordHash = await hashPassword(INITIAL_ADMIN_PASSWORD)
  try {
    await db.user.create({
      data: {
        email: INITIAL_ADMIN_EMAIL,
        name: 'Administrator',
        role: 'ADMIN',
        passwordHash,
        mustChangePassword: true,
      },
    })
  } catch (e) {
    // Another replica created it concurrently.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return 'skipped'
    }
    throw e
  }
  return 'created'
}
