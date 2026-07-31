'use client'

import { useOptimistic, useTransition } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import type { ActionResult } from '@/app/actions/test-runs'

// Pojedyncza flaga InstanceTestRun. Optymistyczny stan + akcja per-pole (reguła 21).
// Tooltip pokazuje ostatnią zmianę tej flagi z ChangeLog (sekcja 8.3).
export function FlagCheckbox({
  runId,
  checked,
  label,
  tooltip,
  disabled = false,
  action,
}: {
  runId: string
  checked: boolean
  label: string
  tooltip?: string
  disabled?: boolean
  action: (runId: string, value: boolean) => Promise<ActionResult>
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked)
  const [, startTransition] = useTransition()

  function toggle(value: boolean) {
    startTransition(async () => {
      setOptimistic(value)
      await action(runId, value)
    })
  }

  return (
    <Checkbox
      checked={optimistic}
      onCheckedChange={toggle}
      disabled={disabled}
      label={label}
      hideLabel
      title={tooltip}
    />
  )
}
