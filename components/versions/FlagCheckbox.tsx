'use client'

import { useOptimistic, useTransition } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { setColumnValue } from '@/app/actions/test-runs'

// Pojedynczy krok (kolumna) dla jednego runu instancji. Optymistyczny stan + zapis
// per-pole (reguła 21). Tooltip pokazuje ostatnią zmianę tego kroku z ChangeLog.
export function FlagCheckbox({
  runId,
  versionColumnId,
  checked,
  label,
  tooltip,
  disabled = false,
}: {
  runId: string
  versionColumnId: string
  checked: boolean
  label: string
  tooltip?: string
  disabled?: boolean
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked)
  const [, startTransition] = useTransition()

  function toggle(value: boolean) {
    startTransition(async () => {
      setOptimistic(value)
      await setColumnValue(runId, versionColumnId, value)
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
