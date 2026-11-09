import type { Palette } from '@prisma/client'

// UI-3: paleta akcentu per konto. Lekki moduł (type-only import) — jak lib/theme.
export const PALETTE_COOKIE = 'palette'

export const PALETTES: Palette[] = ['LIME', 'CYAN', 'COBALT', 'MINT', 'MONO']

export const PALETTE_LABELS: Record<Palette, string> = {
  LIME: 'Limonka',
  CYAN: 'Cyjan',
  COBALT: 'Kobalt',
  MINT: 'Mięta',
  MONO: 'Mono',
}

// Wartość atrybutu data-palette na <html>; LIME = domyślne tokeny (bez atrybutu).
export function paletteAttr(value: string | undefined): string | undefined {
  if (value === 'CYAN' || value === 'COBALT' || value === 'MINT' || value === 'MONO') {
    return value.toLowerCase()
  }
  return undefined
}
