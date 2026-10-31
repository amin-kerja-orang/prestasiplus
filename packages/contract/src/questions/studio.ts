import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * Admin Studio extras (R1-F03b, T13) that the stimulus API (T32, `./stimuli`) does not cover: the DSKP picker and the intake figure
 * link. Groups and stimuli themselves are T32's (D90).
 *
 * Not yet registered as OpenAPI paths: `openapi.json` is owned by another lane.
 */

/** `POST /intake/stimuli/:id/link-references`: the open items of the batch that name the figure and were linked to it now. */
export const StudioFigureLinksSchema = z
  .object({ stimulusId: IdSchema, linkedItemIds: z.array(IdSchema) })
  .meta({ id: 'StudioFigureLinks' })
export type StudioFigureLinks = z.infer<typeof StudioFigureLinksSchema>

/* ------------------------------------------------------------------------------------------------- DSKP picker */

export const StudioDskpSpSchema = z.object({ id: IdSchema, code: z.string(), title: z.string(), skCode: z.string().nullable() }).meta({ id: 'StudioDskpSp' })
export const StudioDskpUnitSchema = z
  .object({ id: IdSchema, code: z.string(), title: z.string(), sps: z.array(StudioDskpSpSchema) })
  .meta({ id: 'StudioDskpUnit' })
export const StudioDskpQuerySchema = z
  .object({ subjectId: IdSchema, educationLevelId: IdSchema })
  .meta({ id: 'StudioDskpQuery' })
export const StudioDskpSchema = z.object({ units: z.array(StudioDskpUnitSchema) }).meta({ id: 'StudioDskp' })
export type StudioDskp = z.infer<typeof StudioDskpSchema>
