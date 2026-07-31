import type { TaskStatus } from '@prisma/client'
import type { BadgeStatus } from '@/components/ui/StatusBadge'

// Wspólne etykiety i wariant wskaźnika dla statusu zadania (serwer + klient).
export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; badge: BadgeStatus }
> = {
  NOT_STARTED: { label: 'Nierozpoczęte', badge: 'neutral' },
  IN_PROGRESS: { label: 'W trakcie', badge: 'warn' },
  DONE: { label: 'Gotowe', badge: 'pass' },
}
