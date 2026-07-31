import { z } from 'zod'

// Komentarz do wersji (TESTER/ADMIN). Niepusty, rozsądny limit długości.
export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Komentarz nie może być pusty')
    .max(5000, 'Komentarz jest zbyt długi'),
})
