'use client'

import { useLivePolling } from '@/lib/hooks/use-live-polling'

// Montuje polling na stronie (widok wersji, dashboard). Nic nie renderuje.
export function LivePolling({ intervalMs = 5000 }: { intervalMs?: number }) {
  useLivePolling(intervalMs)
  return null
}
