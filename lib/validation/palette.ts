import { z } from 'zod'

export const paletteSchema = z.enum(['LIME', 'CYAN', 'COBALT', 'MINT', 'MONO'])
