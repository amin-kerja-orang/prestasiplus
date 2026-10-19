import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * DSKP lookups for the teacher's picking list (mock `handlers/dskp.ts`, catalogue M04-28 to 30).
 * Routes: `GET /guru/dskp/bidang`, `/guru/dskp/sk`, `/guru/dskp/sp`. Roles: admin and teacher.
 *
 * The three answers are BARE ARRAYS, no `{ data }` envelope (mock `raw(200, [...])`, live shape).
 * A missing or non-id query value answers `200 []` (the selects stay empty), never a 422. The
 * records are the DSKP store (M10 data, BE-18 owns the POST writers); a question is tagged with
 * `curriculum_node` only (D53h, v2-exam-schema D9), so `dskp_*` rows are never a question tag.
 *
 * Difference from the mock: ids are strings (UD-1).
 */

/** Step 1 option: `code` is `null` for a Bidang without one (shown as the name alone). */
export const GuruDskpBidangSchema = z
  .strictObject({ id: IdSchema, code: z.string().nullable(), name: z.string() })
  .meta({ id: 'GuruDskpBidang' })

const option = () => z.strictObject({ id: IdSchema, code: z.string(), description: z.string() })

/** Step 2 option (Standard Kandungan). */
export const GuruDskpSkSchema = option().meta({ id: 'GuruDskpSk' })
/** Step 3 option (Standard Pembelajaran). */
export const GuruDskpSpSchema = option().meta({ id: 'GuruDskpSp' })

export const GuruDskpBidangQuerySchema = z
  .object({ subjectId: IdSchema.optional(), educationLevelId: IdSchema.optional() })
  .meta({ id: 'GuruDskpBidangQuery', description: 'Both are needed; if either is missing or not an id the answer is an empty array.' })

export const GuruDskpSkQuerySchema = z
  .object({ bidangId: IdSchema.optional() })
  .meta({ id: 'GuruDskpSkQuery', description: 'Missing or not an id: empty array.' })

export const GuruDskpSpQuerySchema = z
  .object({ skId: IdSchema.optional() })
  .meta({ id: 'GuruDskpSpQuery', description: 'Missing or not an id: empty array.' })

export const GuruDskpBidangListSchema = z.array(GuruDskpBidangSchema).meta({ id: 'GuruDskpBidangList' })
export const GuruDskpSkListSchema = z.array(GuruDskpSkSchema).meta({ id: 'GuruDskpSkList' })
export const GuruDskpSpListSchema = z.array(GuruDskpSpSchema).meta({ id: 'GuruDskpSpList' })
