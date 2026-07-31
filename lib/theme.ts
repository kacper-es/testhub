import type { Theme } from '@prisma/client'

// Lekki moduł (type-only import) — bezpieczny w server layoucie i akcjach.
export const THEME_COOKIE = 'theme'

export function themeClass(value: string | undefined): '' | 'light' | 'dark' {
  if (value === 'LIGHT') return 'light'
  if (value === 'DARK') return 'dark'
  return '' // SYSTEM / brak → media query decyduje
}

export const THEME_LABELS: Record<Theme, string> = {
  LIGHT: 'Jasny',
  DARK: 'Ciemny',
  SYSTEM: 'Systemowy',
}
