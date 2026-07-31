'use client'

import { useState, useTransition } from 'react'
import { setTicketCounters } from '@/app/actions/tasks'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

// TICKET_AGGREGATE — ręczne liczniki, status wyliczany na serwerze (reguła 15).
// total = 0 → wyświetlaj „—", nigdy 0/0 (reguła 15).
export function TicketCounterControl({
  versionTaskId,
  current,
  total,
  disabled = false,
}: {
  versionTaskId: string
  current: number
  total: number
  disabled?: boolean
}) {
  const [curr, setCurr] = useState(String(current))
  const [tot, setTot] = useState(String(total))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (disabled) {
    return (
      <span className="font-mono text-sm text-fg">
        {total === 0 ? '—' : `${current}/${total}`}
      </span>
    )
  }

  const currNum = Number(curr)
  const totNum = Number(tot)
  const invalid =
    !Number.isInteger(currNum) ||
    !Number.isInteger(totNum) ||
    currNum < 0 ||
    totNum < 0 ||
    currNum > totNum
  const dirty = currNum !== current || totNum !== total

  function save() {
    startTransition(async () => {
      setError(null)
      const res = await setTicketCounters(versionTaskId, currNum, totNum)
      if (res.error) setError(res.error)
    })
  }

  const inputCls =
    'w-16 rounded-md border border-border bg-surface px-2 py-1 text-right font-mono text-sm text-fg'

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Rozwiązane"
          className={inputCls}
          value={curr}
          onChange={(e) => setCurr(e.target.value)}
        />
        <span className="font-mono text-sm text-muted">/</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Wszystkie"
          className={inputCls}
          value={tot}
          onChange={(e) => setTot(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={save}
          disabled={pending || invalid || !dirty}
          className={cn('py-1', !dirty && 'opacity-50')}
        >
          {pending ? 'Zapisywanie…' : 'Zapisz'}
        </Button>
      </span>
      {invalid && (
        <span className="text-xs text-fail-strong">
          Podaj liczby całkowite, 0 ≤ rozwiązane ≤ wszystkie.
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-fail-strong">
          {error}
        </span>
      )}
    </span>
  )
}
