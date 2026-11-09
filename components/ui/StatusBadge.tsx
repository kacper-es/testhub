import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeStatus = 'pass' | 'warn' | 'fail' | 'neutral'

const styles: Record<BadgeStatus, { text: string; border: string; dot: string }> = {
  pass: { text: 'text-pass-strong', border: 'border-pass-strong', dot: 'bg-pass' },
  warn: { text: 'text-warn-strong', border: 'border-warn-strong', dot: 'bg-warn' },
  fail: { text: 'text-fail-strong', border: 'border-fail-strong', dot: 'bg-fail' },
  neutral: { text: 'text-muted', border: 'border-border', dot: 'bg-muted' },
}

export function StatusBadge({
  status,
  children,
}: {
  status: BadgeStatus
  children: ReactNode
}) {
  const s = styles[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[3px] border bg-transparent px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider',
        s.text,
        s.border,
      )}
    >
      <span className={cn('h-1.5 w-1.5', s.dot)} aria-hidden />
      {children}
    </span>
  )
}
