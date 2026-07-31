'use client'

import { useOptimistic, useState, useTransition } from 'react'
import type { TaskStatus } from '@prisma/client'
import { setCheckboxTaskStatus } from '@/app/actions/tasks'
import { TASK_STATUS_META } from '@/lib/versions/task-status'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

// CHECKBOX — ręczny status cyklowany NOT_STARTED → IN_PROGRESS → DONE → NOT_STARTED
// (reguła 14). Każdy stan osiągalny w ≤ 2 kliknięcia. Klawiatura działa (button).
const NEXT: Record<TaskStatus, TaskStatus> = {
  NOT_STARTED: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'NOT_STARTED',
}

export function CheckboxTaskControl({
  versionTaskId,
  status,
  disabled = false,
}: {
  versionTaskId: string
  status: TaskStatus
  disabled?: boolean
}) {
  const [optimistic, setOptimistic] = useOptimistic(status)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const meta = TASK_STATUS_META[optimistic]

  if (disabled) {
    return <StatusBadge status={meta.badge}>{meta.label}</StatusBadge>
  }

  function cycle() {
    const next = NEXT[optimistic]
    startTransition(async () => {
      setError(null)
      setOptimistic(next)
      const res = await setCheckboxTaskStatus(versionTaskId, next)
      if (res.error) setError(res.error)
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={cycle}
        aria-label={`Status zadania: ${meta.label}. Kliknij, aby zmienić.`}
        className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {/* key wymusza remount → animacja „wskoczenia" na DONE (sekcja 9.4) */}
        <span
          key={optimistic}
          className={cn(
            'inline-flex cursor-pointer',
            optimistic === 'DONE' && 'animate-check-pop',
          )}
        >
          <StatusBadge status={meta.badge}>{meta.label}</StatusBadge>
        </span>
      </button>
      {error && (
        <span role="alert" className="text-xs text-fail-strong">
          {error}
        </span>
      )}
    </span>
  )
}
