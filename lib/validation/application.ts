import { z } from 'zod'

export const applicationBaseSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę aplikacji'),
  sortOrder: z.coerce.number().int('Kolejność musi być liczbą całkowitą'),
})

// Ikony: rastry akceptowane wprost (bez przetwarzania serwerowego). Serwowane
// przez <img> z nagłówkiem nosniff — SVG świadomie poza listą (patrz PROGRESS).
export const ALLOWED_ICON_TYPES = [
  'image/png',
  'image/webp',
  'image/jpeg',
] as const

export const MAX_ICON_BYTES = 100 * 1024 // 100 KB

export const ICON_ACCEPT = ALLOWED_ICON_TYPES.join(',')

export function isAllowedIconType(type: string): boolean {
  return (ALLOWED_ICON_TYPES as readonly string[]).includes(type)
}
