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

export type InstanceRunFlags = {
  excludedAt: Date | null
  environmentRestored: boolean
  dbScriptsInstalled: boolean
  backendUpdated: boolean
  testsCompleted: boolean
}

export type InstanceAggregate = {
  status: TaskStatus
  done: number
  total: number
}

function allFlags(r: InstanceRunFlags): boolean {
  return (
    r.environmentRestored &&
    r.dbScriptsInstalled &&
    r.backendUpdated &&
    r.testsCompleted
  )
}

function anyFlag(r: InstanceRunFlags): boolean {
  return (
    r.environmentRestored ||
    r.dbScriptsInstalled ||
    r.backendUpdated ||
    r.testsCompleted
  )
}

// INSTANCE_AGGREGATE (reguła 16): mianownik = instancje z excludedAt = null;
// licznik = te z wszystkimi 4 flagami true. DONE gdy licznik = mianownik i
// mianownik > 0; IN_PROGRESS gdy licznik > 0 lub jakakolwiek flaga gdziekolwiek
// true; inaczej NOT_STARTED. Odpięte instancje nie liczą się (reguła 19).
export function instanceAggregateStatus(
  runs: InstanceRunFlags[],
): InstanceAggregate {
  const active = runs.filter((r) => r.excludedAt === null)
  const total = active.length
  const done = active.filter(allFlags).length

  let status: TaskStatus = 'NOT_STARTED'
  if (total > 0 && done === total) {
    status = 'DONE'
  } else if (done > 0 || active.some(anyFlag)) {
    status = 'IN_PROGRESS'
  }

  return { status, done, total }
}
