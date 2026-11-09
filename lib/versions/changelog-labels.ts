// Etykiety pól ChangeLog i wartości do wyświetlenia (log zmian admina, log zdarzeń wersji).
// Pola spoza mapy w InstanceTestRun to id kroku wersji — rozwiązywane na nazwę kroku.
export const FIELD_LABEL: Record<string, string> = {
  status: 'status',
  manualCounterCurrent: 'licznik: rozwiązane',
  manualCounterTotal: 'licznik: wszystkie',
  environmentRestored: 'środowisko odtworzone',
  dbScriptsInstalled: 'skrypty bazodanowe',
  backendUpdated: 'backend podbity',
  testsCompleted: 'testy wykonane',
  notes: 'notatki',
  application: 'aplikacja',
  name: 'nazwa',
  releaseDate: 'data wydania',
  jiraVersion: 'wersja Jira',
  deleted: 'usunięcie wersji',
  pinned: 'przypięte do wersji',
}

export function displayValue(v: string | null): string {
  if (v == null) return '—'
  if (v === 'true') return 'tak'
  if (v === 'false') return 'nie'
  return v
}
