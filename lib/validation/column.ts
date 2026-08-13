import { z } from 'zod'

// Na start jedyny typ pola. Kolejne dojdą do enuma (i tutaj) bez zmiany struktury.
export const columnFieldTypeSchema = z.enum(['CHECKBOX'])

export const columnSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę kroku'),
  fieldType: columnFieldTypeSchema,
  sortOrder: z.coerce.number().int('Kolejność musi być liczbą całkowitą'),
})

export const columnTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę szablonu'),
  isDefault: z.boolean(),
  sortOrder: z.coerce.number().int('Kolejność musi być liczbą całkowitą'),
  // Wybrane kroki (id z katalogu). Pusty zestaw dozwolony — szablon bez kroków.
  columnIds: z.array(z.string().min(1)),
})
