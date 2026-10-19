import { z } from '../zod'

/** A non-negative integer (counts, marks, set numbers). Internal: not re-exported from the barrel. */
export const count = z.number().int().min(0)
