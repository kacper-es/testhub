// Deadline'y i pilność zadań (sekcja 4.6). Wszystko na wartościach date-only
// (YYYY-MM-DD), arytmetyka na UTC-północy — wolna od problemów ze strefą.
// „Dzisiaj" ustala serwer (todayInWarsaw w lib/date), tu tylko czysta arytmetyka.
import type { DeadlineType } from '@prisma/client'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function toUtcMidnight(dateOnly: string): number {
  return Date.parse(`${dateOnly}T00:00:00.000Z`)
}

// Data w formacie YYYY-MM-DD z instancji Date (@db.Date jest północą UTC).
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// deadline zadania = releaseDate − daysBeforeRelease dni (reguła 23). Bez
// pomijania weekendów i świąt. `releaseDate` to Date z bazy (@db.Date).
export function taskDeadline(releaseDate: Date, daysBeforeRelease: number): string {
  const ms = toUtcMidnight(toDateOnly(releaseDate)) - daysBeforeRelease * MS_PER_DAY
  return new Date(ms).toISOString().slice(0, 10)
}

// „Ile dni zostało" wobec ustalonego „dzisiaj" (reguła 25). Dodatnie = przed
// terminem, 0 = dziś, ujemne = po terminie.
export function daysRemaining(deadline: string, today: string): number {
  return Math.round((toUtcMidnight(deadline) - toUtcMidnight(today)) / MS_PER_DAY)
}

export type Urgency = { level: 'pass' | 'warn' | 'fail'; overdue: boolean }

// Progi pilności — dokładnie wg reguły 26: > 7 dni zielony · 3–7 żółty ·
// < 3 czerwony · po terminie czerwony + znacznik „po terminie".
export function urgency(days: number): Urgency {
  if (days < 0) return { level: 'fail', overdue: true }
  if (days < 3) return { level: 'fail', overdue: false }
  if (days <= 7) return { level: 'warn', overdue: false }
  return { level: 'pass', overdue: false }
}

export type DeadlineInfo =
  | { kind: 'flexible' }
  | { kind: 'deadline'; deadline: string; days: number; urgency: Urgency }

// Jedno źródło prawdy dla widoku: FLEXIBLE (lub brak daysBeforeRelease) → brak
// deadline'u, „elastyczny" (reguła 24); inaczej data + dni do wydania + pilność.
export function resolveDeadline(
  deadlineType: DeadlineType,
  daysBeforeRelease: number | null,
  releaseDate: Date,
  today: string,
): DeadlineInfo {
  if (deadlineType === 'FLEXIBLE' || daysBeforeRelease == null) {
    return { kind: 'flexible' }
  }
  const deadline = taskDeadline(releaseDate, daysBeforeRelease)
  const days = daysRemaining(deadline, today)
  return { kind: 'deadline', deadline, days, urgency: urgency(days) }
}
