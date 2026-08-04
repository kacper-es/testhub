import type { Prisma } from '@prisma/client'

// Jeden helper zapisu do ChangeLog, wołany w tej samej transakcji co mutacja
// (reguła 28). Logujemy tylko: 4 flagi i notes w InstanceTestRun oraz status
// i manualCounter* w VersionTask (reguła 27). Pierwszy wywołujący: krok 6a.
export type LogChangeInput = {
  entityType: 'InstanceTestRun' | 'VersionTask' | 'Version'
  entityId: string
  versionId: string | null
  field: string
  oldValue: string | null
  newValue: string | null
  userId: string
}

export function logChange(
  tx: Prisma.TransactionClient,
  input: LogChangeInput,
) {
  return tx.changeLog.create({ data: input })
}
