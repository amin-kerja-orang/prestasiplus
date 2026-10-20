import { z } from '../zod'

/** Internal helpers of the gamification contract (not re-exported from the package index). */

/** Any integer. */
export const int = z.number().int()
/** A non-negative integer (counts, balances, amounts). */
export const count = z.number().int().min(0)
/** A text with at most `max` characters that is not blank (the mock trims and rejects an empty result). */
export const nonBlank = (max: number) => z.string().max(max).regex(/\S/, 'must not be blank')
