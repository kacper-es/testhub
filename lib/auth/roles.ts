import type { Role, User } from '@prisma/client'

// Czysta logika autoryzacji — bez zależności od next/headers ani Prisma runtime,
// żeby dało się ją testować jednostkowo (authz.test.ts).
export class AuthorizationError extends Error {
  constructor(message = 'Brak uprawnień') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export function assertRole(
  user: User | null,
  roles: Role[],
): asserts user is User {
  if (!user || !user.isActive || !roles.includes(user.role)) {
    throw new AuthorizationError()
  }
}
