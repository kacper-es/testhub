import { z } from 'zod'

// CHECKBOX: ręczne NOT_STARTED ⇄ IN_PROGRESS ⇄ DONE (reguła 14).
export const taskStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE'])

// TICKET_AGGREGATE: walidacja 0 ≤ current ≤ total (reguła 15).
export const ticketCountersSchema = z
  .object({
    current: z.number().int().min(0, 'Licznik nie może być ujemny'),
    total: z.number().int().min(0, 'Całość nie może być ujemna'),
  })
  .refine((d) => d.current <= d.total, {
    message: 'Licznik nie może przekraczać całości',
    path: ['current'],
  })
