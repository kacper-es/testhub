import { describe, it, expect } from 'vitest'
import {
  daysRemaining,
  resolveDeadline,
  taskDeadline,
  urgency,
} from '@/lib/versions/deadline'

// @db.Date z bazy przychodzi jako Date w północy UTC.
function dateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

describe('taskDeadline', () => {
  it('odejmuje daysBeforeRelease od releaseDate', () => {
    expect(taskDeadline(dateOnly('2026-08-10'), 3)).toBe('2026-08-07')
  })

  it('przechodzi przez granicę miesiąca', () => {
    expect(taskDeadline(dateOnly('2026-08-01'), 5)).toBe('2026-07-27')
  })

  it('daysBeforeRelease = 0 → deadline w dniu wydania', () => {
    expect(taskDeadline(dateOnly('2026-08-10'), 0)).toBe('2026-08-10')
  })
})

describe('daysRemaining', () => {
  it('liczy pełne dni przed terminem', () => {
    expect(daysRemaining('2026-08-07', '2026-08-01')).toBe(6)
  })

  it('dziś = 0', () => {
    expect(daysRemaining('2026-08-01', '2026-08-01')).toBe(0)
  })

  it('po terminie = wartość ujemna', () => {
    expect(daysRemaining('2026-07-30', '2026-08-01')).toBe(-2)
  })
})

describe('urgency (progi reguły 26)', () => {
  it('> 7 dni → zielony', () => {
    expect(urgency(8)).toEqual({ level: 'pass', overdue: false })
  })

  it('3–7 dni → żółty', () => {
    expect(urgency(7)).toEqual({ level: 'warn', overdue: false })
    expect(urgency(3)).toEqual({ level: 'warn', overdue: false })
  })

  it('< 3 dni → czerwony', () => {
    expect(urgency(2)).toEqual({ level: 'fail', overdue: false })
    expect(urgency(0)).toEqual({ level: 'fail', overdue: false })
  })

  it('po terminie → czerwony + overdue', () => {
    expect(urgency(-1)).toEqual({ level: 'fail', overdue: true })
  })
})

describe('resolveDeadline', () => {
  it('FLEXIBLE → brak deadlinu (elastyczny)', () => {
    expect(
      resolveDeadline('FLEXIBLE', null, dateOnly('2026-08-10'), '2026-08-01'),
    ).toEqual({ kind: 'flexible' })
  })

  it('FLEXIBLE ignoruje przypadkowe daysBeforeRelease', () => {
    expect(
      resolveDeadline('FLEXIBLE', 3, dateOnly('2026-08-10'), '2026-08-01'),
    ).toEqual({ kind: 'flexible' })
  })

  it('DAYS_BEFORE_RELEASE bez daysBeforeRelease → elastyczny (defensywnie)', () => {
    expect(
      resolveDeadline(
        'DAYS_BEFORE_RELEASE',
        null,
        dateOnly('2026-08-10'),
        '2026-08-01',
      ),
    ).toEqual({ kind: 'flexible' })
  })

  it('DAYS_BEFORE_RELEASE → data, dni i pilność', () => {
    expect(
      resolveDeadline(
        'DAYS_BEFORE_RELEASE',
        3,
        dateOnly('2026-08-10'),
        '2026-08-01',
      ),
    ).toEqual({
      kind: 'deadline',
      deadline: '2026-08-07',
      days: 6,
      urgency: { level: 'warn', overdue: false },
    })
  })
})
