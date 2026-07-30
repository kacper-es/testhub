import bcrypt from 'bcryptjs'

// Sekcja 6: bcrypt cost 12.
const COST = 12

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
