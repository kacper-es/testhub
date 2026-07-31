import { z } from 'zod'

export const roleSchema = z.enum(['TESTER', 'PM', 'ADMIN'])

// Tworzenie konta przez ADMIN: hasło tymczasowe → mustChangePassword = true (sekcja 6).
export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Podaj email')
    .email('Nieprawidłowy email'),
  name: z.string().trim().min(1, 'Podaj imię i nazwisko'),
  role: roleSchema,
  password: z
    .string()
    .min(8, 'Hasło tymczasowe musi mieć co najmniej 8 znaków'),
})

// Reset hasła przez ADMIN (brak resetu mailowego, sekcja 6).
export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Nowe hasło musi mieć co najmniej 8 znaków'),
})
