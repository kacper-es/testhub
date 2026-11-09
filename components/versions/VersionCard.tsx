import Link from 'next/link'
import type { TaskStatus } from '@prisma/client'
import { toDateOnly } from '@/lib/versions/deadline'
import type { DashboardVersion, VersionSummary } from '@/lib/versions/summary'
import type { MarkerState } from '@/lib/versions/overview'
import { Eyebrow } from '@/components/ui/Card'
import { AppIcon } from '@/components/versions/AppIcon'
import { cn } from '@/lib/cn'

export type { DashboardVersion } from '@/lib/versions/summary'

const STATUS_BG: Record<TaskStatus, string> = {
  DONE: 'bg-pass',
  IN_PROGRESS: 'bg-warn',
  NOT_STARTED: 'bg-border-strong',
}

const MARKER: Record<MarkerState, string> = {
  done: 'bg-pass border-pass',
  overdue: 'bg-fail border-fail',
  fail: 'bg-fail border-fail',
  warn: 'bg-warn border-warn',
  pass: 'bg-surface border-border-strong',
}

const URGENCY_TEXT = {
  pass: 'text-fg',
  warn: 'text-warn-strong',
  fail: 'text-fail-strong',
} as const

const OPEN_TASKS_SHOWN = 4
const pct = (p: number) => `${(Math.min(1, Math.max(0, p)) * 100).toFixed(2)}%`

function Meter({
  label,
  value,
  done,
  total,
}: {
  label: string
  value: string
  done: number
  total: number
}) {
  const ratio = total > 0 ? done / total : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow className="text-[10px]">{label}</Eyebrow>
        <span className="font-mono text-xs text-fg">{value}</span>
      </div>
      <div className="h-1.5 bg-border" aria-hidden>
        <div className="h-full bg-pass" style={{ width: pct(ratio) }} />
      </div>
    </div>
  )
}

// Karta wersji IN_PROGRESS na dashboardzie (UI-2c „Telemetria"): T−N, mini oś
// terminów, mierniki (checklista, kroki instancji, tickety) i otwarte zadania.
export function VersionCard({
  version,
  summary,
}: {
  version: DashboardVersion
  summary: VersionSummary
}) {
  const { tasks, tasksDone, timeline, daysLeft, urgency: u, instanceAgg, jira } = summary
  const open = tasks
    .filter((t) => t.status !== 'DONE')
    .sort(
      (a, b) =>
        (a.deadline.kind === 'deadline' ? a.deadline.days : Infinity) -
        (b.deadline.kind === 'deadline' ? b.deadline.days : Infinity),
    )

  return (
    <Link
      href={`/versions/${version.id}`}
      className="group relative flex flex-col gap-4 rounded-[4px] border border-border bg-surface p-5 transition-colors before:pointer-events-none before:absolute before:-left-px before:-top-px before:h-2.5 before:w-2.5 before:border-l before:border-t before:border-signal before:content-[''] hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow className="truncate">{version.application?.name ?? 'Bez aplikacji'}</Eyebrow>
          <span className="flex items-center gap-2 font-mono text-xl font-bold">
            <AppIcon app={version.application} />
            <span className="truncate group-hover:underline group-hover:underline-offset-4">
              {version.name}
            </span>
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className={cn('font-mono text-2xl font-bold leading-none', URGENCY_TEXT[u.level])}>
            {daysLeft < 0 ? `T+${-daysLeft}` : `T−${daysLeft}`}
          </span>
          <span className="mt-1 font-mono text-[11px] text-muted">
            {toDateOnly(version.releaseDate)}
          </span>
        </div>
      </div>

      {/* mini oś: dziś → wydanie, terminy zadań jako romby */}
      <div
        className="relative h-4"
        role="img"
        aria-label={`Oś do wydania: ${timeline.markers.length} terminów zadań`}
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
        <div className="absolute top-0 h-4 w-0.5 bg-signal" style={{ left: pct(timeline.todayPos) }} />
        <div className="absolute top-0 h-4 w-0.5 bg-signal" style={{ left: pct(timeline.releasePos) }} />
        {timeline.markers.map((m) => (
          <span
            key={m.id}
            className={cn('absolute top-[4px] h-2 w-2 -translate-x-1/2 rotate-45 border', MARKER[m.state])}
            style={{ left: pct(m.pos) }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow className="text-[10px]">Checklista</Eyebrow>
            <span className="font-mono text-xs text-fg">
              {tasksDone}/{tasks.length}
            </span>
          </div>
          <div className="flex gap-[3px]" aria-hidden>
            {tasks.length === 0 ? (
              <span className="h-1.5 flex-1 bg-border" />
            ) : (
              tasks.map((t) => <span key={t.id} className={cn('h-1.5 flex-1', STATUS_BG[t.status])} />)
            )}
          </div>
        </div>
        <Meter
          label="Kroki instancji"
          value={
            summary.stepsTotal > 0
              ? `${instanceAgg.done}/${instanceAgg.total} gotowych`
              : instanceAgg.total === 0
                ? 'brak instancji'
                : 'brak kroków'
          }
          done={summary.stepsDone}
          total={summary.stepsTotal}
        />
        {jira && (
          <Meter label="Tickety Jira" value={`${jira.done}/${jira.total}`} done={jira.done} total={jira.total} />
        )}
      </div>

      {open.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 border-t border-border p-0 pt-3">
          {open.slice(0, OPEN_TASKS_SHOWN).map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span aria-hidden className={cn('h-2 w-2 shrink-0', STATUS_BG[t.status])} />
              <span className="truncate text-fg">{t.resolved.name}</span>
              <span
                className={cn(
                  'ml-auto shrink-0 font-mono text-[11px]',
                  t.deadline.kind === 'flexible' || t.deadline.urgency.level === 'pass'
                    ? 'text-muted'
                    : t.deadline.urgency.level === 'warn'
                      ? 'text-warn-strong'
                      : 'text-fail-strong',
                )}
              >
                {t.deadline.kind === 'flexible'
                  ? 'elastyczny'
                  : t.deadline.urgency.overdue
                    ? 'po terminie'
                    : t.deadline.days === 0
                      ? 'dziś'
                      : `${t.deadline.days} dni`}
              </span>
            </li>
          ))}
          {open.length > OPEN_TASKS_SHOWN && (
            <li className="font-mono text-[11px] text-muted">
              + {open.length - OPEN_TASKS_SHOWN} otwartych
            </li>
          )}
        </ul>
      )}
      {tasks.length > 0 && open.length === 0 && (
        <p className="m-0 border-t border-border pt-3 font-mono text-xs text-pass-strong">
          ✓ wszystkie zadania gotowe
        </p>
      )}
    </Link>
  )
}
