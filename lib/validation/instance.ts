import { z } from 'zod'

// Katalog instancji (sekcja 8.5). clientName opcjonalny (środowiska wewnętrzne).
export const instanceSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę instancji'),
  clientName: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  keyFunctionalities: z
    .string()
    .trim()
    .min(1, 'Podaj kluczowe funkcjonalności'),
})
