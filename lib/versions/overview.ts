// UI-2b: pure data shaping for the version overview (timeline, burn-up).
// Dates are date-only strings (YYYY-MM-DD); "today" always comes from the server.

const MS_PER_DAY = 24 * 60 * 60 * 1000
const toMs = (d: string) => Date.parse(`${d}T00:00:00.000Z`)
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export type MarkerState = 'done' | 'overdue' | 'pass' | 'warn' | 'fail'

export type TimelineInput = {
  id: string
  name: string
  deadline: string
  done: boolean
  level: 'pass' | 'warn' | 'fail'
  overdue: boolean
}

export type Timeline = {
  start: string
  end: string
  release: string
  spanDays: number
  todayPos: number // 0..1
  releasePos: number // 0..1
  // lane: 0 up-near, 1 down-near, 2 up-far, 3 down-far; -1 = no room for a label
  markers: (TimelineInput & { pos: number; state: MarkerState; lane: number })[]
}

// Axis from the earlier of today / the first deadline to the later of the
// release date / today, so overdue deadlines and an overdue release still fit.
export function buildTimeline(today: string, release: string, items: TimelineInput[]): Timeline {
  const points = [toMs(today), toMs(release), ...items.map((i) => toMs(i.deadline))]
  const startMs = Math.min(...points)
  const endMs = Math.max(toMs(release), toMs(today))
  const spanDays = Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY))
  const pos = (d: string) => (toMs(d) - startMs) / (spanDays * MS_PER_DAY)

  return {
    start: toDay(startMs),
    end: toDay(endMs),
    release,
    spanDays,
    todayPos: pos(today),
    releasePos: pos(release),
    markers: assignLanes(
      items
        .map((i) => ({
          ...i,
          pos: pos(i.deadline),
          state: (i.done ? 'done' : i.overdue ? 'overdue' : i.level) as MarkerState,
        }))
        .sort((a, b) => a.pos - b.pos),
    ),
  }
}

export const TIMELINE_LANES = 4
const MIN_LABEL_GAP = 0.25 // fraction of the axis a label needs in its lane (labels are ≤ 7rem)

// Greedy: each marker (sorted by pos) takes the first lane whose previous label
// is far enough away; none free → lane -1 (diamond only, name in its tooltip).
export function assignLanes<T extends { pos: number }>(sorted: T[]): (T & { lane: number })[] {
  const lastPos: number[] = Array(TIMELINE_LANES).fill(-Infinity)
  return sorted.map((m) => {
    const lane = lastPos.findIndex((p) => m.pos - p >= MIN_LABEL_GAP)
    if (lane >= 0) lastPos[lane] = m.pos
    return { ...m, lane }
  })
}

export type BurnupPoint = { day: string; total: number; done: number }

// Last `windowDays` days ending today, starting no earlier than the first
// snapshot; days without a sync carry the previous values forward.
export function buildBurnup(
  snapshots: { day: Date; total: number; done: number }[],
  today: string,
  windowDays = 14,
): BurnupPoint[] {
  if (snapshots.length === 0) return []
  const byDay = new Map(snapshots.map((s) => [s.day.toISOString().slice(0, 10), s]))
  const firstMs = Math.min(...snapshots.map((s) => s.day.getTime()))
  const todayMs = toMs(today)
  const startMs = Math.max(firstMs, todayMs - (windowDays - 1) * MS_PER_DAY)

  // Carry-in: the latest snapshot before the window start.
  const before = snapshots
    .filter((s) => s.day.getTime() < startMs)
    .sort((a, b) => b.day.getTime() - a.day.getTime())[0]
  let last = before ? { total: before.total, done: before.done } : undefined

  const out: BurnupPoint[] = []
  for (let ms = startMs; ms <= todayMs; ms += MS_PER_DAY) {
    const day = toDay(ms)
    const s = byDay.get(day)
    if (s) last = { total: s.total, done: s.done }
    if (last) out.push({ day, ...last })
  }
  return out
}

// SVG polyline points for scope (total) and done, in a w×h box with padding.
export function burnupPolylines(
  points: BurnupPoint[],
  w: number,
  h: number,
  pad = 6,
): { scope: string; done: string; last: { x: number; y: number } } | null {
  if (points.length < 2) return null
  const max = Math.max(1, ...points.map((p) => p.total))
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - 2 * pad)
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad)
  const line = (key: 'total' | 'done') =>
    points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  const lastI = points.length - 1
  return {
    scope: line('total'),
    done: line('done'),
    last: { x: x(lastI), y: y(points[lastI].done) },
  }
}

export type MonthBucket = { month: string; released: number; cancelled: number }

// UI-2c archive chart: closed versions per release month, the last `months`
// months ending with today's month (empty months included).
export function monthlyClosed(
  items: { releaseDay: string; status: 'RELEASED' | 'CANCELLED' }[],
  today: string,
  months = 12,
): MonthBucket[] {
  const [y, m] = today.split('-').map(Number)
  const buckets: MonthBucket[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    buckets.push({ month: d.toISOString().slice(0, 7), released: 0, cancelled: 0 })
  }
  const byMonth = new Map(buckets.map((b) => [b.month, b]))
  for (const it of items) {
    const b = byMonth.get(it.releaseDay.slice(0, 7))
    if (!b) continue
    if (it.status === 'RELEASED') b.released++
    else b.cancelled++
  }
  return buckets
}
