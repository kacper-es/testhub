import { describe, it, expect } from 'vitest'
import {
  instanceAggregateStatus,
  ticketAggregateStatus,
  type InstanceRunReadiness,
} from '@/lib/versions/aggregates'

describe('ticketAggregateStatus (reguła 15)', () => {
  it('total = 0 → NOT_STARTED (UI pokazuje —, bez dzielenia przez zero)', () => {
    expect(ticketAggregateStatus(0, 0)).toBe('NOT_STARTED')
  })

  it('current = 0, total > 0 → NOT_STARTED', () => {
    expect(ticketAggregateStatus(0, 5)).toBe('NOT_STARTED')
  })

  it('0 < current < total → IN_PROGRESS', () => {
    expect(ticketAggregateStatus(2, 5)).toBe('IN_PROGRESS')
  })

  it('current = total, total > 0 → DONE', () => {
    expect(ticketAggregateStatus(5, 5)).toBe('DONE')
  })

  it('current > total → DONE (nadmiar liczy się jako gotowe)', () => {
    expect(ticketAggregateStatus(7, 5)).toBe('DONE')
  })
})

// Helper: run z liczbą zaznaczonych kroków (spośród N kroków checkbox wersji).
function run(trueCount: number, excludedAt: Date | null = null): InstanceRunReadiness {
  return { excludedAt, trueCount }
}

// N = liczba aktywnych kroków checkbox wersji (mianownik gotowości pojedynczego runu).
const N = 4

describe('instanceAggregateStatus (reguła 16)', () => {
  it('brak instancji → NOT_STARTED, 0/0', () => {
    expect(instanceAggregateStatus([], N)).toEqual({
      status: 'NOT_STARTED',
      done: 0,
      total: 0,
    })
  })

  it('wszystkie instancje odpięte → NOT_STARTED, 0/0', () => {
    const runs = [run(N, new Date()), run(0, new Date())]
    expect(instanceAggregateStatus(runs, N)).toEqual({
      status: 'NOT_STARTED',
      done: 0,
      total: 0,
    })
  })

  it('żaden krok nie zaznaczony → NOT_STARTED', () => {
    expect(instanceAggregateStatus([run(0), run(0)], N)).toEqual({
      status: 'NOT_STARTED',
      done: 0,
      total: 2,
    })
  })

  it('część kroków zaznaczona → IN_PROGRESS', () => {
    const runs = [run(1), run(0)]
    expect(instanceAggregateStatus(runs, N)).toEqual({
      status: 'IN_PROGRESS',
      done: 0,
      total: 2,
    })
  })

  it('część instancji gotowa → IN_PROGRESS', () => {
    const runs = [run(N), run(0)]
    expect(instanceAggregateStatus(runs, N)).toEqual({
      status: 'IN_PROGRESS',
      done: 1,
      total: 2,
    })
  })

  it('wszystkie aktywne gotowe → DONE (odpięte nie liczą się)', () => {
    const runs = [run(N), run(N), run(N, new Date())]
    expect(instanceAggregateStatus(runs, N)).toEqual({
      status: 'DONE',
      done: 2,
      total: 2,
    })
  })

  it('wersja bez kroków checkbox (N = 0) → NOT_STARTED, nic nie jest gotowe', () => {
    const runs = [run(0), run(0)]
    expect(instanceAggregateStatus(runs, 0)).toEqual({
      status: 'NOT_STARTED',
      done: 0,
      total: 2,
    })
  })
})
