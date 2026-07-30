// Sekcja 6: rate limit logowania 5 prób / 15 min per email, licznik w pamięci
// procesu (jeden kontener — wystarczy). Liczymy nieudane próby; sukces resetuje.

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

type Entry = { count: number; firstAt: number }

const attempts = new Map<string, Entry>()

function key(email: string): string {
  return email.trim().toLowerCase()
}

export function isRateLimited(email: string): boolean {
  const e = attempts.get(key(email))
  if (!e) return false
  if (Date.now() - e.firstAt > WINDOW_MS) {
    attempts.delete(key(email))
    return false
  }
  return e.count >= MAX_ATTEMPTS
}

export function recordFailedAttempt(email: string): void {
  const k = key(email)
  const now = Date.now()
  const e = attempts.get(k)
  if (!e || now - e.firstAt > WINDOW_MS) {
    attempts.set(k, { count: 1, firstAt: now })
    return
  }
  e.count += 1
}

export function resetAttempts(email: string): void {
  attempts.delete(key(email))
}
