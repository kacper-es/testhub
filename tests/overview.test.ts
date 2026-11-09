import { describe, it, expect } from 'vitest'
import {
  assignLanes,
  buildBurnup,
  buildTimeline,
  burnupPolylines,
  monthlyClosed,
} from '@/lib/versions/overview'

const d = (s: string) => new Date(`${s}T00:00:00Z`)

describe('buildTimeline (UI-2b)', () => {
  const base = { done: false, level: 'pass' as const, overdue: false }

  it('axis from today to release, markers by date', () => {
    const t = buildTimeline('2026-11-09', '2026-11-27', [
      { ...base, id: 'b', name: 'B', deadline: '2026-11-17' },
      { ...base, id: 'a', name: 'A', deadline: '2026-11-13', level: 'fail' },
    ])
    expect(t.spanDays).toBe(18)
    expect(t.todayPos).toBe(0)
    expect(t.releasePos).toBe(1)
    expect(t.markers.map((m) => m.id)).toEqual(['a', 'b'])
    expect(t.markers[0].pos).toBeCloseTo(4 / 18)
    expect(t.markers[0].state).toBe('fail')
  })

  it('overdue deadline stretches the axis to the left of today', () => {
    const t = buildTimeline('2026-11-09', '2026-11-19', [
      { ...base, id: 'x', name: 'X', deadline: '2026-11-04', overdue: true, level: 'fail' },
    ])
    expect(t.start).toBe('2026-11-04')
    expect(t.markers[0].pos).toBe(0)
    expect(t.markers[0].state).toBe('overdue')
    expect(t.todayPos).toBeCloseTo(5 / 15)
  })

  it('done wins over urgency; overdue release keeps today at the end', () => {
    const t = buildTimeline('2026-11-09', '2026-11-01', [
      { ...base, id: 'x', name: 'X', deadline: '2026-10-30', done: true, overdue: true },
    ])
    expect(t.markers[0].state).toBe('done')
    expect(t.todayPos).toBe(1)
    expect(t.releasePos).toBeLessThan(1)
  })
})

describe('buildBurnup (UI-2b)', () => {
  it('no snapshots → empty', () => {
    expect(buildBurnup([], '2026-11-09')).toEqual([])
  })

  it('starts at the first snapshot and carries values over days without sync', () => {
    const pts = buildBurnup(
      [
        { day: d('2026-11-06'), total: 30, done: 5 },
        { day: d('2026-11-08'), total: 32, done: 9 },
      ],
      '2026-11-09',
    )
    expect(pts).toEqual([
      { day: '2026-11-06', total: 30, done: 5 },
      { day: '2026-11-07', total: 30, done: 5 },
      { day: '2026-11-08', total: 32, done: 9 },
      { day: '2026-11-09', total: 32, done: 9 },
    ])
  })

  it('window keeps the last N days, carrying in the value from before it', () => {
    const pts = buildBurnup(
      [
        { day: d('2026-10-01'), total: 10, done: 1 },
        { day: d('2026-11-08'), total: 12, done: 4 },
      ],
      '2026-11-09',
      3,
    )
    expect(pts).toEqual([
      { day: '2026-11-07', total: 10, done: 1 },
      { day: '2026-11-08', total: 12, done: 4 },
      { day: '2026-11-09', total: 12, done: 4 },
    ])
  })
})

describe('burnupPolylines', () => {
  it('needs at least two points', () => {
    expect(burnupPolylines([{ day: '2026-11-09', total: 1, done: 0 }], 100, 50)).toBeNull()
  })

  it('scales to the box, scope on top', () => {
    const p = burnupPolylines(
      [
        { day: 'a', total: 10, done: 0 },
        { day: 'b', total: 10, done: 10 },
      ],
      100,
      50,
      0,
    )!
    expect(p.scope).toBe('0.0,0.0 100.0,0.0')
    expect(p.done).toBe('0.0,50.0 100.0,0.0')
    expect(p.last).toEqual({ x: 100, y: 0 })
  })
})

describe('assignLanes', () => {
  it('spreads close markers over lanes, drops labels when all lanes are taken', () => {
    const lanes = assignLanes([0, 0.01, 0.02, 0.03, 0.04, 0.6].map((pos) => ({ pos }))).map((m) => m.lane)
    expect(lanes).toEqual([0, 1, 2, 3, -1, 0])
  })
})

describe('monthlyClosed', () => {
  it('buckets the last N months incl. empty ones, across a year boundary', () => {
    const b = monthlyClosed(
      [
        { releaseDay: '2026-01-15', status: 'RELEASED' },
        { releaseDay: '2025-12-02', status: 'CANCELLED' },
        { releaseDay: '2025-12-20', status: 'RELEASED' },
        { releaseDay: '2025-06-01', status: 'RELEASED' }, // outside the window
      ],
      '2026-02-10',
      3,
    )
    expect(b).toEqual([
      { month: '2025-12', released: 1, cancelled: 1 },
      { month: '2026-01', released: 1, cancelled: 0 },
      { month: '2026-02', released: 0, cancelled: 0 },
    ])
  })
})
