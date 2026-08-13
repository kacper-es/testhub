import type { TaskStatus } from '@prisma/client'

// Logika statusów zadań agregujących (sekcja 4.4). Czyste funkcje — status
// nigdy nie jest odczytywany z pola `status` dla agregatów, tylko wyliczany.

// TICKET_AGGREGATE (reguła 15): DONE gdy current >= total && total > 0;
// IN_PROGRESS gdy current > 0; inaczej NOT_STARTED. Przy total = 0 status jest
// NOT_STARTED, a UI wyświetla „—" (nigdy 0/0 ani dzielenia przez zero).
export function ticketAggregateStatus(current: number, total: number): TaskStatus {
  if (total > 0 && current >= total) return 'DONE'
  if (current > 0) return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

// Gotowość jednego runu instancji: ile jego kroków checkbox jest zaznaczonych
// (`trueCount`) spośród `checkboxColumnCount` aktywnych kroków checkbox wersji.
export type InstanceRunReadiness = {
  excludedAt: Date | null
  trueCount: number
}

export type InstanceAggregate = {
  status: TaskStatus
  done: number
  total: number
}

// INSTANCE_AGGREGATE (reguła 16), wersja dynamiczna: mianownik = instancje z
// excludedAt = null; licznik = te z wszystkimi aktywnymi krokami checkbox true.
// DONE gdy licznik = mianownik i oba > 0; IN_PROGRESS gdy licznik > 0 lub gdzieś
// jest zaznaczony krok; inaczej NOT_STARTED. Odpięte instancje nie liczą się
// (reguła 19). Wersja bez kroków checkbox (checkboxColumnCount = 0) → „brak
// kryteriów": nic nie jest gotowe (done = 0), nie ma pustej „gotowości".
export function instanceAggregateStatus(
  runs: InstanceRunReadiness[],
  checkboxColumnCount: number,
): InstanceAggregate {
  const active = runs.filter((r) => r.excludedAt === null)
  const total = active.length
  const n = checkboxColumnCount
  const done = n > 0 ? active.filter((r) => r.trueCount >= n).length : 0

  let status: TaskStatus = 'NOT_STARTED'
  if (n > 0 && total > 0 && done === total) {
    status = 'DONE'
  } else if (done > 0 || active.some((r) => r.trueCount > 0)) {
    status = 'IN_PROGRESS'
  }

  return { status, done, total }
}
