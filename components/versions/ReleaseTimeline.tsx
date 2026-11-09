import type { CSSProperties } from 'react'
import type { MarkerState, Timeline } from '@/lib/versions/overview'
import { cn } from '@/lib/cn'

const MARKER: Record<MarkerState, string> = {
  done: 'bg-pass border-pass',
  overdue: 'bg-fail border-fail',
  fail: 'bg-fail border-fail',
  warn: 'bg-warn border-warn',
  pass: 'bg-surface border-border-strong',
}

const DATE_TEXT: Record<MarkerState, string> = {
  done: 'text-pass-strong',
  overdue: 'text-fail-strong',
  fail: 'text-fail-strong',
  warn: 'text-warn-strong',
  pass: 'text-muted',
}

// Vertical layout (px): two label lanes above the axis, two below, a bottom
// row for "dziś" / "release".
const AXIS_Y = 86
const LANE_TOP = [42, 98, 4, 136] // lane 0 up-near, 1 down-near, 2 up-far, 3 down-far
const BOTTOM_ROW = 176

const ddmm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`
const clamp = (p: number) => Math.min(1, Math.max(0, p))
const pct = (p: number) => `${(clamp(p) * 100).toFixed(2)}%`

// Labels near an edge are anchored to it so they never leave the box.
function anchored(pos: number): { style: CSSProperties; align: string } {
  const p = clamp(pos)
  if (p < 0.1) return { style: { left: pct(p) }, align: 'items-start text-left' }
  if (p > 0.9) return { style: { right: pct(1 - p) }, align: 'items-end text-right' }
  return { style: { left: pct(p), transform: 'translateX(-50%)' }, align: 'items-center text-center' }
}

// UI-2b: oś czasu do wydania — terminy zadań jako romby, etykiety rozłożone
// na tory (assignLanes). Wszystkie pozycje policzone na serwerze (buildTimeline).
export function ReleaseTimeline({ timeline }: { timeline: Timeline }) {
  const { markers, todayPos, releasePos, spanDays } = timeline
  const label = `Oś czasu: ${markers.length} terminów zadań, wydanie ${ddmm(timeline.release)}`
  const today = anchored(todayPos)
  const release = anchored(releasePos)
  // "dziś" and "release" share the bottom row; drop "dziś" when they would collide.
  const showToday = Math.abs(todayPos - releasePos) >= 0.12

  return (
    <div role="img" aria-label={label} className="relative h-[194px] select-none">
      <div className="absolute inset-x-0 h-px bg-border-strong" style={{ top: AXIS_Y }} />
      <div
        aria-hidden
        className="absolute inset-x-0 h-[9px] opacity-60"
        style={{
          top: AXIS_Y - 4,
          backgroundImage:
            'repeating-linear-gradient(90deg, var(--border-strong) 0 1px, transparent 1px 100%)',
          backgroundSize: `calc(100% / ${spanDays > 45 ? Math.ceil(spanDays / 7) : spanDays}) 100%`,
        }}
      />

      {/* dziś + wydanie: pionowe kreski sygnału */}
      <div className="absolute w-0.5 bg-signal" style={{ left: pct(todayPos), top: AXIS_Y - 14, height: 28 }} />
      <div className="absolute w-0.5 bg-signal" style={{ left: pct(releasePos), top: AXIS_Y - 22, height: 44 }} />

      {markers.map((m) => (
        <span
          key={m.id}
          title={`${m.name} — ${ddmm(m.deadline)}`}
          className={cn('absolute h-2.5 w-2.5 -translate-x-1/2 rotate-45 border', MARKER[m.state])}
          style={{ left: pct(m.pos), top: AXIS_Y - 5 }}
        />
      ))}

      {markers
        .filter((m) => m.lane >= 0)
        .map((m) => {
          const a = anchored(m.pos)
          return (
            <span
              key={m.id}
              className={cn('absolute flex flex-col font-mono', a.align)}
              style={{ ...a.style, top: LANE_TOP[m.lane] }}
            >
              <span className={cn('text-[10px] leading-tight', DATE_TEXT[m.state])}>
                {ddmm(m.deadline)}
              </span>
              <span className="max-w-[7rem] truncate text-[11px] leading-tight text-fg">{m.name}</span>
            </span>
          )
        })}

      {showToday && (
        <span
          className={cn('absolute flex font-mono text-[10px] uppercase tracking-wider text-muted', today.align)}
          style={{ ...today.style, top: BOTTOM_ROW }}
        >
          dziś
        </span>
      )}
      <span
        className={cn(
          'absolute flex font-mono text-[11px] font-bold uppercase tracking-wider text-pass-strong',
          release.align,
        )}
        style={{ ...release.style, top: BOTTOM_ROW }}
      >
        release {ddmm(timeline.release)}
      </span>
    </div>
  )
}
