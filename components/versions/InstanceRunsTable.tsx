import type { Instance, InstanceTestRun } from '@prisma/client'
import {
  setBackendUpdated,
  setDbScriptsInstalled,
  setEnvironmentRestored,
  setTestsCompleted,
  unpinInstanceRun,
  type ActionResult,
} from '@/app/actions/test-runs'
import { FlagCheckbox } from '@/components/versions/FlagCheckbox'
import { NotesField } from '@/components/versions/NotesField'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

type Run = InstanceTestRun & { instance: Instance }

// Ostatnia zmiana danej flagi, mapowana kluczem `${runId}:${field}` (z ChangeLog).
export type LastChangeMap = Map<string, { user: string; when: string }>

const FLAGS = [
  {
    field: 'environmentRestored',
    header: 'Środowisko',
    tip: 'środowisko odtworzone',
    action: setEnvironmentRestored,
  },
  {
    field: 'dbScriptsInstalled',
    header: 'Skrypty DB',
    tip: 'skrypty bazodanowe',
    action: setDbScriptsInstalled,
  },
  {
    field: 'backendUpdated',
    header: 'Backend',
    tip: 'backend podbity',
    action: setBackendUpdated,
  },
  {
    field: 'testsCompleted',
    header: 'Testy',
    tip: 'testy wykonane',
    action: setTestsCompleted,
  },
] as const satisfies ReadonlyArray<{
  field: keyof Run
  header: string
  tip: string
  action: (runId: string, value: boolean) => Promise<ActionResult>
}>

function tooltip(
  run: Run,
  field: string,
  tip: string,
  lastChanges: LastChangeMap,
): string {
  const last = lastChanges.get(`${run.id}:${field}`)
  return last ? `${tip}: ${last.user}, ${last.when}` : tip
}

function Flags({
  run,
  disabled,
  lastChanges,
}: {
  run: Run
  disabled: boolean
  lastChanges: LastChangeMap
}) {
  return (
    <>
      {FLAGS.map((f) => (
        <FlagCheckbox
          key={f.field}
          runId={run.id}
          checked={run[f.field] as boolean}
          label={f.header}
          tooltip={tooltip(run, f.field, f.tip, lastChanges)}
          disabled={disabled}
          action={f.action}
        />
      ))}
    </>
  )
}

function UnpinButton({ runId }: { runId: string }) {
  return (
    <form action={unpinInstanceRun}>
      <input type="hidden" name="runId" value={runId} />
      <Button variant="ghost" type="submit" className="text-fail-strong">
        Odepnij
      </Button>
    </form>
  )
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

export function InstanceRunsTable({
  runs,
  disabled,
  lastChanges,
}: {
  runs: Run[]
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

  return (
    <div>
      {/* Desktop: tabela */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 font-semibold text-muted">Instancja</th>
            {FLAGS.map((f) => (
              <th
                key={f.field}
                className="px-2 py-2 text-center font-semibold text-muted"
              >
                {f.header}
              </th>
            ))}
            <th className="px-3 py-2 font-semibold text-muted">Notatki</th>
            {!disabled && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-border align-top">
              <td className="px-3 py-2">
                <InstanceName instance={run.instance} />
              </td>
              {FLAGS.map((f) => (
                <td key={f.field} className="px-2 py-2 text-center">
                  <FlagCheckbox
                    runId={run.id}
                    checked={run[f.field] as boolean}
                    label={f.header}
                    tooltip={tooltip(run, f.field, f.tip, lastChanges)}
                    disabled={disabled}
                    action={f.action}
                  />
                </td>
              ))}
              <td className="px-3 py-2">
                <NotesField
                  runId={run.id}
                  notes={run.notes}
                  disabled={disabled}
                />
              </td>
              {!disabled && (
                <td className="px-3 py-2 text-right">
                  <UnpinButton runId={run.id} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: karty (sekcja 9.4 — bez poziomego scrolla) */}
      <div className="flex flex-col gap-3 md:hidden">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <InstanceName instance={run.instance} />
              {!disabled && <UnpinButton runId={run.id} />}
            </div>
            <div className="flex flex-col gap-2">
              {FLAGS.map((f) => (
                <div
                  key={f.field}
                  className={cn('flex items-center justify-between gap-3')}
                >
                  <span className="text-sm text-muted">{f.header}</span>
                  <FlagCheckbox
                    runId={run.id}
                    checked={run[f.field] as boolean}
                    label={f.header}
                    tooltip={tooltip(run, f.field, f.tip, lastChanges)}
                    disabled={disabled}
                    action={f.action}
                  />
                </div>
              ))}
            </div>
            <NotesField runId={run.id} notes={run.notes} disabled={disabled} />
          </div>
        ))}
      </div>
    </div>
  )
}
