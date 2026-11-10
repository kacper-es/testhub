import type { Instance, InstanceTestRun } from '@prisma/client'
import { FlagCheckbox } from '@/components/versions/FlagCheckbox'
import { InfoPopover } from '@/components/ui/InfoPopover'
import { ClampText } from '@/components/ui/ClampText'
import { cn } from '@/lib/cn'

type Run = InstanceTestRun & { instance: Instance }

// Column widths (rem): instance name, minimum per step, the Σ column.
const INSTANCE_COL_REM = 14
const STEP_COL_MIN_REM = 5.5
const SUM_COL_REM = 4.5

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

// UI-5: key functionalities — ⓘ bubble on desktop, clamped text under the name on mobile.
function InstanceName({ instance, mobile }: { instance: Instance; mobile?: boolean }) {
  const key = instance.keyFunctionalities.trim()
  return (
    <span className="flex flex-col">
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-fg">{instance.name}</span>
        {key && !mobile && (
          <InfoPopover label={`Kluczowe funkcjonalności: ${instance.name}`}>
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              Kluczowe funkcjonalności
            </span>
            {key}
          </InfoPopover>
        )}
      </span>
      {instance.clientName && <span className="text-xs text-muted">{instance.clientName}</span>}
      {key && mobile && <ClampText text={key} className="mt-1" />}
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
    return <p className="text-sm text-muted">Brak podpiętych instancji w tej wersji.</p>
  }

  const isChecked = (runId: string, columnId: string) => values.get(`${runId}:${columnId}`) ?? false

  return (
    <div className="flex flex-col gap-3">
      {columns.length === 0 && (
        <p className="text-sm text-muted">Ta wersja nie ma kroków — dodaj je w edycji wersji.</p>
      )}

      {/* Desktop: tabela (przewija się w swoim kontenerze przy wielu krokach).
          UI-4: table-fixed — wszystkie kolumny kroków mają tę samą szerokość,
          niezależnie od długości nazwy (dłuższe nazwy łamią się w nagłówku). */}
      <div className="hidden overflow-x-auto md:block">
        <table
          className="w-full table-fixed border-collapse text-sm"
          style={{ minWidth: `${INSTANCE_COL_REM + columns.length * STEP_COL_MIN_REM + SUM_COL_REM}rem` }}
        >
          <colgroup>
            <col style={{ width: `${INSTANCE_COL_REM}rem` }} />
            {columns.map((c) => (
              <col key={c.id} />
            ))}
            <col style={{ width: `${SUM_COL_REM}rem` }} />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              <th className="px-3 py-2 font-medium">Instancja</th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="break-words px-1 py-2 text-center align-bottom font-medium leading-tight"
                >
                  {c.name}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Σ</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const count = columns.filter((c) => isChecked(run.id, c.id)).length
              const full = columns.length > 0 && count === columns.length
              return (
                <tr
                  key={run.id}
                  className="border-b border-border align-middle last:border-b-0 hover:bg-surface-raised"
                >
                  <td className="break-words px-3 py-2">
                    <InstanceName instance={run.instance} />
                  </td>
                  {columns.map((c) => (
                    <td key={c.id} className="px-1 py-1.5 text-center">
                      <FlagCheckbox
                        runId={run.id}
                        versionColumnId={c.id}
                        checked={isChecked(run.id, c.id)}
                        label={c.name}
                        tooltip={tooltip(run.id, c.id, c.name, lastChanges)}
                        disabled={disabled}
                        variant="cell"
                      />
                    </td>
                  ))}
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono text-xs',
                      full ? 'text-pass-strong' : count === 0 ? 'text-muted' : 'text-fg',
                    )}
                  >
                    {count}/{columns.length}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: karty (sekcja 9.4 — bez poziomego scrolla) */}
      <div className="flex flex-col gap-3 md:hidden">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-col gap-3 rounded-[4px] border border-border bg-bg p-3"
          >
            <InstanceName instance={run.instance} mobile />
            {columns.length > 0 && (
              <div className="flex flex-col gap-2">
                {columns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3">
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
