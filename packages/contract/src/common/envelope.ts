import { z } from '../zod'

/**
 * Pagination meta of every list response. Module aggregates are allowed next to the standard keys
 * (`looseObject`); `from`/`to` are 1-based and `null` on an empty page (Laravel style).
 */
export const ListMetaSchema = z
  .looseObject({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    from: z.number().int().min(1).nullable().optional(),
    to: z.number().int().min(1).nullable().optional(),
    counts: z.record(z.string(), z.number()).optional(),
  })
  .meta({ id: 'ListMeta' })
export type ListMeta = z.infer<typeof ListMetaSchema>

/** Query parameters shared by paginated lists. */
export const PageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .meta({ id: 'PageQuery' })
export type PageQuery = z.infer<typeof PageQuerySchema>

/** `{ data: T }` */
export function envelopeOf<T extends z.ZodType>(data: T) {
  return z.object({ data })
}

/** `{ data: T[], meta }` */
export function listEnvelopeOf<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: ListMetaSchema })
}
