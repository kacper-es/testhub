'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

const WIDTH = 288 // px, matches w-72
const GAP = 6
const EDGE = 8

// UI-5: an ⓘ button with a tooltip-style bubble. Hover or focus shows it, a click
// pins it open (touch), Esc / outside click / scroll closes it. Rendered in a
// portal with fixed positioning, so scrolling containers (the runs table) don't clip it.
export function InfoPopover({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [pinned, setPinned] = useState(false)

  const show = useCallback(() => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - WIDTH - EDGE))
    setPos({ top: r.bottom + GAP, left })
  }, [])

  const close = useCallback(() => {
    setPos(null)
    setPinned(false)
  }, [])

  const open = pos !== null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (!btn.current?.contains(t) && !bubble.current?.contains(t)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={() => {
          if (!pinned) setPos(null)
        }}
        onFocus={show}
        onBlur={() => {
          if (!pinned) setPos(null)
        }}
        onClick={() => {
          if (pinned) close()
          else {
            show()
            setPinned(true)
          }
        }}
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-[11px] font-semibold leading-none text-muted hover:border-fg hover:text-fg',
          open && 'border-fg text-fg',
          className,
        )}
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            className="fixed z-50 max-h-[50vh] overflow-y-auto whitespace-pre-line break-words rounded-[4px] border border-border-strong bg-surface p-3 text-sm text-fg shadow-lg"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
