import type { VersionStatus } from '@prisma/client'

// Wersja zamknięta jest read-only wymuszone po stronie serwera (reguła 12).
// Używane w akcjach statusu oraz (od 6a/6b/6c) w mutacjach zadań/instancji/komentarzy.
export class VersionClosedError extends Error {
  constructor() {
    super('Wersja jest zamknięta — tylko do odczytu')
    this.name = 'VersionClosedError'
  }
}

export function assertVersionEditable(status: VersionStatus): void {
  if (status !== 'IN_PROGRESS') {
    throw new VersionClosedError()
  }
}
