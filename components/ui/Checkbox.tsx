'use client'

import { cn } from '@/lib/cn'

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
  hideLabel,
  title,
  variant = 'box',
}: {
  checked: boolean
  onCheckedChange?: (value: boolean) => void
  label: string
  disabled?: boolean
  hideLabel?: boolean
  title?: string
  // 'cell': kafel macierzy instancji × kroki (UI-2b, makieta Telemetria).
  variant?: 'box' | 'cell'
}) {
  if (variant === 'cell') {
    return (
      <label
        title={title}
        className={cn('block w-full select-none', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
      >
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
            'flex h-7 w-full min-w-10 items-center justify-center rounded-[2px] border transition-colors',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
            checked
              ? 'animate-check-pop border-pass bg-pass'
              : 'border-border-strong bg-surface-raised',
            !disabled && !checked && 'hover:border-signal',
            disabled && 'opacity-60',
          )}
        >
          {checked && (
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="var(--on-pass)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 8.5l3.5 3.5L13 4.5" />
            </svg>
          )}
        </span>
        <span className="sr-only">{label}</span>
      </label>
    )
  }


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
            'flex h-5 w-5 items-center justify-center rounded-[3px] border transition-colors',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
            checked
              ? 'animate-check-pop border-pass bg-pass'
              : 'border-border-strong bg-bg',
          )}
        >
          {checked && (
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="var(--on-pass)"
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
