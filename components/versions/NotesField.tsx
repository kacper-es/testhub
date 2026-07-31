'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { setNotes } from '@/app/actions/test-runs'

type SaveState = 'idle' | 'saving' | 'saved'

// Notatki z ochroną przed nadpisaniem przez polling (sekcja 7): dopóki pole ma
// focus albo jest „dirty", dane z serwera są ignorowane. Zapis debounce 800 ms
// z widocznym wskaźnikiem. Po udanym zapisie pole znów przyjmuje dane z serwera.
export function NotesField({
  runId,
  notes,
  disabled = false,
}: {
  runId: string
  notes: string | null
  disabled?: boolean
}) {
  const [value, setValue] = useState(notes ?? '')
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<SaveState>('idle')
  const focused = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, startTransition] = useTransition()

  // Przyjmuj dane z serwera tylko gdy pole nie jest edytowane.
  useEffect(() => {
    if (!dirty && !focused.current) setValue(notes ?? '')
  }, [notes, dirty])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  if (disabled) {
    return (
      <p className="whitespace-pre-wrap text-sm text-fg">
        {value || <span className="text-muted">—</span>}
      </p>
    )
  }

  function scheduleSave(next: string) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setStatus('saving')
      startTransition(async () => {
        const res = await setNotes(runId, next)
        setDirty(false)
        setStatus(res.error ? 'idle' : 'saved')
      })
    }, 800)
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={value}
        rows={2}
        placeholder="Notatki…"
        aria-label="Notatki instancji"
        className="w-full min-w-40 rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg"
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
        }}
        onChange={(e) => {
          setValue(e.target.value)
          setDirty(true)
          setStatus('idle')
          scheduleSave(e.target.value)
        }}
      />
      <span aria-live="polite" className="h-4 text-xs text-muted">
        {status === 'saving'
          ? 'zapisywanie…'
          : status === 'saved'
            ? 'zapisano'
            : ''}
      </span>
    </div>
  )
}
