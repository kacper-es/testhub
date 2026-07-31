'use client'

import { cn } from '@/lib/cn'

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
  hideLabel,
  title,
}: {
  checked: boolean
  onCheckedChange?: (value: boolean) => void
  label: string
  disabled?: boolean
  hideLabel?: boolean
  title?: string
}) {
  return (
    <label
      title={title}
      className={cn(
        'inline-flex select-none items-center gap-2',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <span className="relative inline-flex">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
            checked
              ? 'animate-check-pop border-pass-strong bg-pass'
              : 'border-border bg-surface',
          )}
        >
          {checked && (
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 8.5l3.5 3.5L13 4.5" />
            </svg>
          )}
        </span>
      </span>
      <span className={cn('text-sm text-fg', hideLabel && 'sr-only')}>
        {label}
      </span>
    </label>
  )
}
