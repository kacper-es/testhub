'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Polling live-updates (sekcja 7): co intervalMs wołaj router.refresh(). Reszta
// zostaje Server Components — bez duplikowania stanu w kliencie. Pauza gdy
// document.hidden; na powrót do widoczności — natychmiastowy refresh. Jeden hook
// w jednym miejscu, nie kopiowany po stronach.
export function useLivePolling(intervalMs = 5000): void {
  const router = useRouter()

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer === null) {
        timer = setInterval(() => router.refresh(), intervalMs)
      }
    }
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        router.refresh()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [router, intervalMs])
}
