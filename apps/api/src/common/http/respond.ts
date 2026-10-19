import type { ListMeta } from '@pp/contract'

/** `{ data }` */
export const ok = <T>(data: T): { data: T } => ({ data })

/** `{ data, meta }` for paginated lists. */
export const okList = <T>(data: T[], meta: ListMeta): { data: T[]; meta: ListMeta } => ({
  data,
  meta,
})

/** Builds the standard `ListMeta` (1-based `from`/`to`, null on an empty page). */
export function listMeta(page: number, pageSize: number, totalItems: number): ListMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = (page - 1) * pageSize
  const from = start >= totalItems ? null : start + 1
  const to = from === null ? null : Math.min(totalItems, page * pageSize)
  return { page, pageSize, totalItems, totalPages, from, to }
}
