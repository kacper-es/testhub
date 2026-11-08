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
  // Szablon kroków („flow") podpinany przy tworzeniu. Puste = bez kroków.
  columnTemplateId: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
})

export const updateVersionSchema = z.object({
  versionId: z.string().min(1),
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

// Dodanie zadań z szablonów do istniejącej wersji (reguła 6).
// Puste templateId = wszystkie brakujące aktywne szablony.
export const addVersionTasksSchema = z.object({
  versionId: z.string().min(1),
  templateId: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
})

// Trwałe usunięcie wersji (ADMIN) — potwierdzenie przez wpisanie nazwy.
export const deleteVersionSchema = z.object({
  versionId: z.string().min(1),
  confirmName: z.string().trim().min(1, 'Wpisz nazwę wersji, aby potwierdzić'),
})

export const cancelVersionSchema = z.object({
  versionId: z.string().min(1),
  reason: z.string().trim().min(1, 'Podaj powód anulowania'),
})
