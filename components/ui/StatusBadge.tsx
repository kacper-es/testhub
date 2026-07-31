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
        'inline-flex items-center gap-1.5 rounded-full border bg-surface px-2 py-0.5 text-xs font-medium',
        s.text,
        s.border,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', s.dot)} aria-hidden />
      {children}
    </span>
  )
}
