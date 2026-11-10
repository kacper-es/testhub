'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

// UI-5: text clamped to two lines with a "więcej / mniej" toggle, shown only
// when the text actually overflows.
export function ClampText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [text, expanded])

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <p
        ref={ref}
        className={cn('m-0 whitespace-pre-line break-words text-xs text-muted', !expanded && 'line-clamp-2')}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="rounded-[2px] text-xs font-medium text-fg underline underline-offset-2"
        >
          {expanded ? 'mniej' : 'więcej'}
        </button>
      )}
    </div>
  )
}
