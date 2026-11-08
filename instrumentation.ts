// Runs once when the Next.js server starts (in Docker: after `prisma migrate deploy`).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { prisma } = await import('@/lib/prisma')
  const { ensureInitialAdmin, INITIAL_ADMIN_EMAIL } = await import('@/lib/auth/bootstrap')

  if ((await ensureInitialAdmin(prisma)) === 'created') {
    console.log(
      `Created initial admin account ${INITIAL_ADMIN_EMAIL} with the default password — ` +
        'it must be changed on first login.',
    )
  }
}
