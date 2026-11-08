import { describe, it, expect } from 'vitest'
import { cookieSecure } from '@/lib/auth/cookie'

describe('cookieSecure', () => {
  it('unset → secure in production', () => {
    expect(cookieSecure(undefined, 'production')).toBe(true)
  })

  it('empty (compose default) → secure in production', () => {
    expect(cookieSecure('', 'production')).toBe(true)
  })

  it('unset → not secure outside production', () => {
    expect(cookieSecure(undefined, 'development')).toBe(false)
  })

  it('false → explicit opt-out in production (plain HTTP)', () => {
    expect(cookieSecure('false', 'production')).toBe(false)
    expect(cookieSecure(' FALSE ', 'production')).toBe(false)
  })

  it('true → forced on outside production', () => {
    expect(cookieSecure('true', 'development')).toBe(true)
  })

  it('unrecognised value → falls back to the production default', () => {
    expect(cookieSecure('no', 'production')).toBe(true)
  })
})
