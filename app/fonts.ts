import localFont from 'next/font/local'

// Fonts vendored in /public/fonts (section 9.2) — the build runs without internet.
// Source: Google Fonts (OFL), variable woff2. Each family ships as two subsets
// (latin + latin-ext for Polish glyphs); the font-family stack lists both and the
// browser falls through per glyph, unicode-range keeps the ext file lazy.
// adjustFontFallback off: its catch-all fallback face would shadow the latin-ext
// family for Polish glyphs. unicode-range values must be literals inside each loader call (Next font loader rule).

export const spaceGrotesk = localFont({
  variable: '--font-sans-a',
  display: 'swap',
  adjustFontFallback: false,
  src: '../public/fonts/space-grotesk-latin-var.woff2',
  weight: '300 700',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})

export const spaceGroteskExt = localFont({
  variable: '--font-sans-b',
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  src: '../public/fonts/space-grotesk-latin-ext-var.woff2',
  weight: '300 700',
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
})

export const jetbrainsMono = localFont({
  variable: '--font-mono-a',
  display: 'swap',
  adjustFontFallback: false,
  src: '../public/fonts/jetbrains-mono-latin-var.woff2',
  weight: '400 700',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})

export const jetbrainsMonoExt = localFont({
  variable: '--font-mono-b',
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  src: '../public/fonts/jetbrains-mono-latin-ext-var.woff2',
  weight: '400 700',
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
})

export const fontVariables = [spaceGrotesk, spaceGroteskExt, jetbrainsMono, jetbrainsMonoExt]
  .map((f) => f.variable)
  .join(' ')
