import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Podaj email').email('Nieprawidłowy email'),
  password: z.string().min(1, 'Podaj hasło'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Podaj obecne hasło'),
    newPassword: z.string().min(8, 'Nowe hasło musi mieć co najmniej 8 znaków'),
    confirmPassword: z.string().min(1, 'Powtórz nowe hasło'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Hasła nie są identyczne',
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ['newPassword'],
    message: 'Nowe hasło musi różnić się od obecnego',
  })
