import { z } from 'zod'

export const taskTypeSchema = z.enum([
  'CHECKBOX',
  'TICKET_AGGREGATE',
  'INSTANCE_AGGREGATE',
])
export const deadlineTypeSchema = z.enum(['FLEXIBLE', 'DAYS_BEFORE_RELEASE'])

// Puste stringi z formularza traktujemy jak brak (inaczej z.coerce.number('')→0).
const emptyToUndefined = (v: unknown) =>
  v === '' || v == null ? undefined : v

const daysField = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ message: 'Liczba dni musi być liczbą' })
    .int('Liczba dni musi być liczbą')
    .min(0, 'Liczba dni nie może być ujemna')
    .optional(),
)

const sortField = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ message: 'Kolejność musi być liczbą' })
    .int('Kolejność musi być liczbą'),
)

// Pola edytowalne na żywo (reguła 4). taskType jest niezmienny (reguła 7) i
// obsługiwany osobno tylko przy tworzeniu.
export const templateBaseSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę'),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  deadlineType: deadlineTypeSchema,
  daysBeforeRelease: daysField,
  sortOrder: sortField,
})
