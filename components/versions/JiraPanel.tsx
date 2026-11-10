import type { JiraIssue } from '@prisma/client'
import { Card, Eyebrow } from '@/components/ui/Card'
import { StatusBadge, type BadgeStatus } from '@/components/ui/StatusBadge'
import { burnupPolylines, type BurnupPoint } from '@/lib/versions/overview'
import type { TypeBreakdown, TypeGroup } from '@/lib/jira/issue-types'
import { cn } from '@/lib/cn'

// Kategoria statusu Jiry → kolor odznaki (J-4).
const JIRA_CATEGORY_BADGE: Record<string, BadgeStatus> = {
  new: 'neutral',
  indeterminate: 'warn',
  done: 'pass',
}

const W = 300
const H = 110
const ddmm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`

const SUMMARY =
  'flex min-h-8 cursor-pointer list-none items-center gap-2 font-mono text-[13px] [&::-webkit-details-marker]:hidden'

function Caret() {
  return (
    <span
      aria-hidden
      className="inline-block text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none"
    >
      ▶
    </span>
  )
}

function IssueList({
  issues,
  browseUrl,
  className,
}: {
  issues: JiraIssue[]
  browseUrl: string | null
  className?: string
}) {
  return (
    <ul className={cn('flex flex-col divide-y divide-border overflow-y-auto', className)}>
      {issues.map((i) => (
        <li key={i.id} className="flex flex-col gap-1 py-2 pr-1 text-sm">
          <span className="flex items-center justify-between gap-2">
            {browseUrl ? (
              <a
                href={`${browseUrl}${encodeURIComponent(i.key)}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[13px] text-fg underline underline-offset-2"
              >
                {i.key}
              </a>
            ) : (
              <span className="font-mono text-[13px] text-fg">{i.key}</span>
            )}
            <StatusBadge status={JIRA_CATEGORY_BADGE[i.statusCategory] ?? 'neutral'}>
              {i.statusName}
            </StatusBadge>
          </span>
          <span className="text-fg">{i.summary}</span>
          <span className="font-mono text-[11px] text-muted">
            {i.issueType}
            {i.assigneeName ? ` · ${i.assigneeName}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

// J-7: one collapsible row per tracked type (+ "Inne"): done/total and a thin bar.
function TypeRow({
  group,
  label,
  browseUrl,
}: {
  group: TypeGroup<JiraIssue>
  label: string
  browseUrl: string | null
}) {
  const total = group.issues.length
  return (
    <li>
      <details className="group">
        <summary className={cn(SUMMARY, 'flex-wrap py-1', total === 0 && 'cursor-default')}>
          <Caret />
          <span className="min-w-0 flex-1 truncate text-fg">{label}</span>
          <span className={total > 0 && group.done === total ? 'text-pass-strong' : 'text-muted'}>
            {group.done}/{total}
          </span>
          <span aria-hidden className="flex h-1 w-full basis-full bg-surface-raised">
            {total > 0 && <span className="bg-pass" style={{ flex: group.done }} />}
            {total > 0 && <span style={{ flex: total - group.done }} />}
          </span>
        </summary>
        {total === 0 ? (
          <p className="mb-2 mt-1 text-sm text-muted">Brak ticketów tego typu.</p>
        ) : (
          <IssueList issues={group.issues} browseUrl={browseUrl} className="mb-2 max-h-[50vh]" />
        )}
      </details>
    </li>
  )
}

// UI-2b: panel Jira w widoku wersji — podział statusów, burn-up z dziennych
// stanów (JiraSnapshot) i zwijana lista ticketów (lokalna kopia, bez odpytywania Jiry).
export function JiraPanel({
  jiraVersionName,
  syncedText,
  issues,
  burnup,
  browseUrl,
  breakdown,
  typesHint,
}: {
  jiraVersionName: string | null
  syncedText: string | null
  issues: JiraIssue[] // sorted: not done first
  burnup: BurnupPoint[]
  browseUrl: string | null
  breakdown: TypeBreakdown<JiraIssue> | null // null = no tracked types
  typesHint: boolean // ADMIN and no tracked types → point to Admin → Jira
}) {
  const done = issues.filter((i) => i.statusCategory === 'done').length
  const inProgress = issues.filter((i) => i.statusCategory === 'indeterminate').length
  const todo = issues.length - done - inProgress
  const lines = burnupPolylines(burnup, W, H)
  const first = burnup[0]
  const last = burnup[burnup.length - 1]

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0">
          <Eyebrow>Jira · {jiraVersionName ?? 'fixVersion'}</Eyebrow>
        </h2>
        {syncedText && <span className="font-mono text-[11px] text-muted">{syncedText}</span>}
      </div>

      {!syncedText ? (
        <p className="text-sm text-muted">
          Tickety nie były jeszcze synchronizowane — administrator robi to w edycji wersji.
        </p>
      ) : (
        <>
          <div>
            <div
              className="flex h-3.5 gap-0.5"
              role="img"
              aria-label={`Gotowe ${done}, w toku ${inProgress}, do zrobienia ${todo}`}
            >
              {done > 0 && <div className="bg-pass" style={{ flex: done }} />}
              {inProgress > 0 && <div className="bg-warn" style={{ flex: inProgress }} />}
              {todo > 0 && <div className="bg-border-strong" style={{ flex: todo }} />}
              {issues.length === 0 && <div className="flex-1 bg-border" />}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs text-muted">
              <div className="flex flex-col-reverse">
                <dt>gotowe</dt>
                <dd className="m-0 text-2xl font-bold text-pass-strong">{done}</dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt>w toku</dt>
                <dd className="m-0 text-2xl font-bold text-warn-strong">{inProgress}</dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt>do zrobienia</dt>
                <dd className="m-0 text-2xl font-bold text-fg">{todo}</dd>
              </div>
            </dl>
          </div>

          {breakdown && (
            <div>
              <Eyebrow>Według typu</Eyebrow>
              <ul className="mt-2 flex flex-col gap-1">
                {breakdown.groups.map((g) => (
                  <TypeRow key={g.name} group={g} label={g.name} browseUrl={browseUrl} />
                ))}
                {breakdown.other.issues.length > 0 && (
                  <TypeRow
                    group={breakdown.other}
                    label={`Inne (${breakdown.other.typeCount} ${breakdown.other.typeCount === 1 ? 'typ' : breakdown.other.typeCount < 5 ? 'typy' : 'typów'})`}
                    browseUrl={browseUrl}
                  />
                )}
              </ul>
            </div>
          )}
          {!breakdown && typesHint && (
            <p className="text-sm text-muted">
              Podział według typu: wybierz typy w{' '}
              <a href="/admin/jira" className="text-fg underline underline-offset-2">
                Admin → Jira
              </a>
              .
            </p>
          )}

          <div>
            <Eyebrow>Burn-up{lines ? ` · ${burnup.length} dni` : ''}</Eyebrow>
            {lines ? (
              <>
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="mt-2 h-32 w-full"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`Burn-up: zakres ${first.total} → ${last.total}, gotowe ${first.done} → ${last.done}`}
                >
                  {[0.25, 0.5, 0.75].map((f) => (
                    <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--border)" strokeWidth="1" />
                  ))}
                  <polyline
                    points={lines.scope}
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={lines.done}
                    fill="none"
                    stroke="var(--status-pass)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div className="flex justify-between font-mono text-[11px] text-muted">
                  <span>{ddmm(first.day)}</span>
                  <span>- - zakres {last.total}</span>
                  <span>{ddmm(last.day)}</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Wykres pojawi się po synchronizacjach z co najmniej dwóch dni.
              </p>
            )}
          </div>

          <details className="group border-t border-border pt-3">
            <summary className={SUMMARY}>
              <Caret />
              Lista ticketów ({issues.length})
            </summary>
            {issues.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Brak ticketów w tej wersji Jira.</p>
            ) : (
              <IssueList issues={issues} browseUrl={browseUrl} className="mt-2 max-h-[60vh]" />
            )}
          </details>
        </>
      )}
    </Card>
  )
}
