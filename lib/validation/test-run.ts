import { z } from 'zod'

// Notatki instancji w wersji — wolny tekst, log zmian (reguła 27).
export const notesSchema = z.string().max(5000, 'Notatka jest zbyt długa')
