import { z } from 'zod'

export const createVersionSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę wersji'),
  releaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Podaj poprawną datę wydania'),
  // Puste = brak aplikacji (relacja opcjonalna).
  applicationId: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
})

export const setVersionApplicationSchema = z.object({
  versionId: z.string().min(1),
  applicationId: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
})

export const cancelVersionSchema = z.object({
  versionId: z.string().min(1),
  reason: z.string().trim().min(1, 'Podaj powód anulowania'),
})
