import { describe, it, expect } from 'vitest'
import {
  instanceAggregateStatus,
  ticketAggregateStatus,
  type InstanceRunFlags,
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

function run(flags: Partial<InstanceRunFlags>): InstanceRunFlags {
  return {
    excludedAt: null,
    environmentRestored: false,
    dbScriptsInstalled: false,
    backendUpdated: false,
    testsCompleted: false,
    ...flags,
  }
}

const ALL_TRUE = {
  environmentRestored: true,
  dbScriptsInstalled: true,
  backendUpdated: true,
  testsCompleted: true,
}

describe('instanceAggregateStatus (reguła 16)', () => {
  it('brak instancji → NOT_STARTED, 0/0', () => {
    expect(instanceAggregateStatus([])).toEqual({
      status: 'NOT_STARTED',
      done: 0,
      total: 0,
    })
  })

  it('wszystkie instancje odpięte → NOT_STARTED, 0/0', () => {
    const runs = [
      run({ ...ALL_TRUE, excludedAt: new Date() }),
      run({ excludedAt: new Date() }),
    ]
    expect(instanceAggregateStatus(runs)).toEqual({
      status: 'NOT_STARTED',
      done: 0,
      total: 0,
    })
  })

  it('żadna flaga nie ustawiona → NOT_STARTED', () => {
    expect(instanceAggregateStatus([run({}), run({})])).toEqual({
      status: 'NOT_STARTED',
      done: 0,
      total: 2,
    })
  })

  it('część flag ustawiona → IN_PROGRESS', () => {
    const runs = [run({ backendUpdated: true }), run({})]
    expect(instanceAggregateStatus(runs)).toEqual({
      status: 'IN_PROGRESS',
      done: 0,
      total: 2,
    })
  })

  it('część instancji gotowa → IN_PROGRESS', () => {
    const runs = [run(ALL_TRUE), run({})]
    expect(instanceAggregateStatus(runs)).toEqual({
      status: 'IN_PROGRESS',
      done: 1,
      total: 2,
    })
  })

  it('wszystkie aktywne gotowe → DONE (odpięte nie liczą się)', () => {
    const runs = [
      run(ALL_TRUE),
      run(ALL_TRUE),
      run({ excludedAt: new Date() }),
    ]
    expect(instanceAggregateStatus(runs)).toEqual({
      status: 'DONE',
      done: 2,
      total: 2,
    })
  })
})
