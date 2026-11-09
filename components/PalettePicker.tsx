'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Palette } from '@prisma/client'
import { setPalette, type SetPaletteState } from '@/app/actions/palette'
import { PALETTES, PALETTE_LABELS } from '@/lib/palette'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const initial: SetPaletteState = {}

// UI-3: wybór palety akcentu. Każda karta to podgląd w barwach swojej palety
// (data-palette na karcie), w bieżącym motywie. Zapis przez server action.
export function PalettePicker({ current }: { current: Palette }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(setPalette, initial)

  useEffect(() => {
    if (state.saved) router.refresh()
  }, [state, router])

  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2 xl:grid-cols-5">
        <legend className="sr-only">Paleta kolorów</legend>
        {PALETTES.map((p) => (
          <label
            key={p}
            data-palette={p.toLowerCase()}
            className={cn(
              'group relative flex cursor-pointer flex-col gap-3 rounded-[4px] border bg-surface p-4',
              'has-[:checked]:border-signal has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
              'border-border hover:border-border-strong',
            )}
          >
            <input
              type="radio"
              name="palette"
              value={p}
              defaultChecked={p === current}
              className="peer sr-only"
            />
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium text-fg">{PALETTE_LABELS[p]}</span>
              <span
                aria-hidden
                className="font-mono text-[11px] uppercase tracking-wider text-pass-strong opacity-0 group-has-[:checked]:opacity-100"
              >
                ● wybrana
              </span>
            </span>
            {/* mini podgląd: przycisk, pasek postępu, znacznik i status */}
            <span aria-hidden className="flex flex-col gap-2">
              <span className="inline-flex w-fit rounded-[3px] bg-accent px-3 py-1 text-xs font-semibold text-on-accent">
                Akcja
              </span>
              <span className="flex gap-[3px]">
                <span className="h-1.5 flex-1 bg-pass" />
                <span className="h-1.5 flex-1 bg-pass" />
                <span className="h-1.5 flex-1 bg-warn" />
                <span className="h-1.5 flex-1 bg-border-strong" />
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px]">
                <span className="h-2.5 w-2.5 rotate-45 border border-signal" />
                <span className="text-pass-strong">GOTOWE</span>
                <span className="text-warn-strong">W TOKU</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisuję…' : 'Zapisz paletę'}
        </Button>
        {state.error && (
          <span role="alert" className="text-sm text-fail-strong">
            {state.error}
          </span>
        )}
        {state.saved && !pending && (
          <span role="status" className="text-sm text-muted">
            Zapisano.
          </span>
        )}
      </div>
    </form>
  )
}
