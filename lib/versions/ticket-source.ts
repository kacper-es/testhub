import type { TaskStatus, VersionStatus } from '@prisma/client'
import { ticketAggregateStatus } from '@/lib/versions/aggregates'

// Skąd zadanie TICKET_AGGREGATE bierze liczby (J-4). Jedno źródło prawdy dla
// podglądu wersji, dashboardu i akcji ręcznego licznika.
//   jira            — wersja podpięta do Jiry i zsynchronizowana: done/total z JiraIssue
//   jira-unsynced   — podpięta, jeszcze bez synchronizacji: „—"
//   unmapped        — integracja skonfigurowana, wersja otwarta i niepodpięta: „—"
//   manual-edit     — integracja nieskonfigurowana, wersja otwarta: ręczne liczniki
//   manual-readonly — wersja zamknięta bez danych z Jiry: historyczne wartości ręczne
// Przy wszystkich wariantach z liczbami total = 0 → UI pokazuje „—" (reguła 15).

export type TicketSourceMode =
  | 'jira'
  | 'jira-unsynced'
  | 'unmapped'
  | 'manual-edit'
  | 'manual-readonly'

export type TicketView = {
  mode: TicketSourceMode
  current: number
  total: number
  status: TaskStatus
}

export type JiraCounts = { done: number; total: number }

export function ticketTaskView(input: {
  versionStatus: VersionStatus
  jiraMapped: boolean
  jiraSynced: boolean
  jiraConfigured: boolean
  manual: { current: number; total: number }
  jira: JiraCounts | null
}): TicketView {
  const open = input.versionStatus === 'IN_PROGRESS'

  if (input.jiraMapped && input.jiraSynced) {
    const done = input.jira?.done ?? 0
    const total = input.jira?.total ?? 0
    return { mode: 'jira', current: done, total, status: ticketAggregateStatus(done, total) }
  }
  if (input.jiraMapped && open) {
    return { mode: 'jira-unsynced', current: 0, total: 0, status: 'NOT_STARTED' }
  }
  if (open && input.jiraConfigured) {
    return { mode: 'unmapped', current: 0, total: 0, status: 'NOT_STARTED' }
  }
  const { current, total } = input.manual
  return {
    mode: open ? 'manual-edit' : 'manual-readonly',
    current,
    total,
    status: ticketAggregateStatus(current, total),
  }
}
