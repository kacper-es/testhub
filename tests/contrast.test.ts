import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// UI-2a: guards the contrast invariant (CLAUDE.md) for both themes —
// text ≥ 4.5:1, UI elements ≥ 3:1 — straight from the tokens in globals.css.
const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
  )
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const themes = { light: block(':root,\n  .light {'), dark: block('.dark {') }

// UI-3: every palette × theme, palette overrides merged onto the base tokens.
const PALETTES = ['lime', 'cyan', 'cobalt', 'mint', 'mono']
const variants: [string, Record<string, string>][] = PALETTES.flatMap(
  (p): [string, Record<string, string>][] => [
    [`${p} / light`, { ...themes.light, ...block(`[data-palette='${p}'] {`) }],
    [`${p} / dark`, { ...themes.dark, ...block(`.dark [data-palette='${p}'] {`) }],
  ],
)

it('palette blocks exist and override the accent', () => {
  for (const p of PALETTES) {
    expect(block(`[data-palette='${p}'] {`)['accent']).toBeDefined()
    expect(block(`.dark [data-palette='${p}'] {`)['accent']).toBeDefined()
  }
})

it('lime palette repeats the base tokens (used by the settings preview)', () => {
  for (const [k, v] of Object.entries(block(`[data-palette='lime'] {`))) {
    expect(themes.light[k]).toBe(v)
  }
  for (const [k, v] of Object.entries(block(`.dark [data-palette='lime'] {`))) {
    expect(themes.dark[k]).toBe(v)
  }
})

it.each(PALETTES)('system dark for %s matches its explicit dark block', (p) => {
  expect(block(`:root:not(.light):not(.dark) [data-palette='${p}'] {`)).toEqual(
    block(`.dark [data-palette='${p}'] {`),
  )
})

describe.each([...Object.entries(themes), ...variants])('contrast — %s', (_name, t) => {
  it('parsed the tokens', () => {
    expect(Object.keys(t).length).toBeGreaterThan(15)
  })

  it.each(['text', 'text-muted', 'text-pass', 'text-warn', 'text-fail'])(
    '%s ≥ 4.5:1 on bg, surface and surface-raised',
    (fg) => {
      for (const bg of ['bg', 'surface', 'surface-raised']) {
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('text on accent ≥ 4.5:1', () => {
    expect(ratio(t['on-accent'], t['accent'])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['status-pass', 'status-warn', 'status-fail', 'signal', 'focus', 'border-strong'])(
    '%s ≥ 3:1 against surface and bg',
    (ui) => {
      expect(ratio(t[ui], t['surface'])).toBeGreaterThanOrEqual(3)
      expect(ratio(t[ui], t['bg'])).toBeGreaterThanOrEqual(3)
    },
  )

  it('check mark on a checked box ≥ 3:1', () => {
    expect(ratio(t['on-pass'], t['status-pass'])).toBeGreaterThanOrEqual(3)
  })
})

it('system dark (media query) matches the explicit dark theme', () => {
  const start = css.indexOf(':root:not(.light):not(.dark)')
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const sys = Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
  )
  expect(sys).toEqual(themes.dark)
})
