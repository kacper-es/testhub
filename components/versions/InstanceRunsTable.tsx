import type { Instance, InstanceTestRun } from '@prisma/client'
import { FlagCheckbox } from '@/components/versions/FlagCheckbox'

type Run = InstanceTestRun & { instance: Instance }

// Aktywne kroki (kolumny) wersji — kopie z VersionColumn.
export type RunColumn = { id: string; name: string }

// Wartość kroku dla runu, klucz `${runId}:${versionColumnId}` (brak = false).
export type ValueMap = Map<string, boolean>

// Ostatnia zmiana kroku, klucz `${runId}:${versionColumnId}` (z ChangeLog).
export type LastChangeMap = Map<string, { user: string; when: string }>

function tooltip(
  runId: string,
  columnId: string,
  base: string,
  lastChanges: LastChangeMap,
): string {
  const last = lastChanges.get(`${runId}:${columnId}`)
  return last ? `${base}: ${last.user}, ${last.when}` : base
}

function InstanceName({ instance }: { instance: Instance }) {
  return (
    <span className="flex flex-col">
      <span className="font-medium text-fg">{instance.name}</span>
      {instance.clientName && (
        <span className="text-xs text-muted">{instance.clientName}</span>
      )}
    </span>
  )
}

// Tabela robocza w podglądzie wersji: instancje × kroki (checkboxy). Podpinanie
// i odpinanie instancji jest w edycji wersji, nie tutaj.
export function InstanceRunsTable({
  runs,
  columns,
  values,
  disabled,
  lastChanges,
}: {
  runs: Run[]
  columns: RunColumn[]
  values: ValueMap
  disabled: boolean
  lastChanges: LastChangeMap
}) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted">
        Brak podpiętych instancji w tej wersji.
      </p>
    )
  }

  const isChecked = (runId: string, columnId: string) =>
    values.get(`${runId}:${columnId}`) ?? false

  return (
    <div className="flex flex-col gap-3">
      {columns.length === 0 && (
        <p className="text-sm text-muted">
          Ta wersja nie ma kroków — dodaj je w edycji wersji.
        </p>
      )}

      {/* Desktop: tabela (przewija się w swoim kontenerze przy wielu krokach) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 font-semibold text-muted">Instancja</th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="px-2 py-2 text-center font-semibold text-muted"
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-border align-top">
                <td className="px-3 py-2">
                  <InstanceName instance={run.instance} />
                </td>
                {columns.map((c) => (
                  <td key={c.id} className="px-2 py-2 text-center">
                    <FlagCheckbox
                      runId={run.id}
                      versionColumnId={c.id}
                      checked={isChecked(run.id, c.id)}
                      label={c.name}
                      tooltip={tooltip(run.id, c.id, c.name, lastChanges)}
                      disabled={disabled}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: karty (sekcja 9.4 — bez poziomego scrolla) */}
      <div className="flex flex-col gap-3 md:hidden">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <InstanceName instance={run.instance} />
            {columns.length > 0 && (
              <div className="flex flex-col gap-2">
                {columns.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-muted">{c.name}</span>
                    <FlagCheckbox
                      runId={run.id}
                      versionColumnId={c.id}
                      checked={isChecked(run.id, c.id)}
                      label={c.name}
                      tooltip={tooltip(run.id, c.id, c.name, lastChanges)}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
