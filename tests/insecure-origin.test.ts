import { describe, it, expect } from 'vitest'
import { secureCookieWillBeDropped } from '@/lib/auth/insecure-origin'

describe('secureCookieWillBeDropped', () => {
  it('HTTP + secure cookies → dropped', () => {
    expect(secureCookieWillBeDropped('http://10.0.0.5:3000/login', true)).toBe(true)
    expect(secureCookieWillBeDropped('http://releasehub.firma.pl', true)).toBe(true)
  })

  it('HTTPS → fine', () => {
    expect(secureCookieWillBeDropped('https://releasehub.firma.pl/login', true)).toBe(false)
  })

  it('COOKIE_SECURE=false → fine over HTTP', () => {
    expect(secureCookieWillBeDropped('http://10.0.0.5:3000', false)).toBe(false)
  })

  it('localhost is exempt (browsers accept Secure cookies there)', () => {
    expect(secureCookieWillBeDropped('http://localhost:3000', true)).toBe(false)
    expect(secureCookieWillBeDropped('http://127.0.0.1:3000', true)).toBe(false)
    expect(secureCookieWillBeDropped('http://[::1]:3000', true)).toBe(false)
    expect(secureCookieWillBeDropped('http://app.localhost:3000', true)).toBe(false)
  })

  it('missing or malformed origin → no warning', () => {
    expect(secureCookieWillBeDropped(null, true)).toBe(false)
    expect(secureCookieWillBeDropped('null', true)).toBe(false)
  })
})
