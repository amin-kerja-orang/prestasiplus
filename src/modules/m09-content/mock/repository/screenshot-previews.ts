/**
 * Session image URLs of the screenshots uploaded in this browser (S14, DV-M09-23). The mock never
 * persists the bytes: a file uploaded now is served from an object URL so the page can show it, and a
 * file without one (after a page reload) falls back to the `blob:mock/...` placeholder.
 *
 * An entry is bound to the row it was made for (id, stored file name and creation time), so after a
 * mock reset a reused id can never show the image of an earlier file: it no longer matches and its
 * URL is revoked the next time the list is read (`pruneTo`).
 */

/** The identity of a stored screenshot row that a preview belongs to. */
export interface PreviewRow {
  id: number
  fileName: string
  createdAt: string
}

interface Entry {
  fileName: string
  createdAt: string
  url: string
}

const previews = new Map<number, Entry>()

function drop(id: number): void {
  const entry = previews.get(id)
  if (!entry) return
  if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(entry.url)
  previews.delete(id)
}

/** Keeps an object URL of `file` for the screenshot `row` (replacing and revoking an older one). */
export function rememberPreview(row: PreviewRow, file: Blob): void {
  if (typeof URL.createObjectURL !== 'function') return
  drop(row.id)
  previews.set(row.id, {
    fileName: row.fileName,
    createdAt: row.createdAt,
    url: URL.createObjectURL(file),
  })
}

/** The object URL of a screenshot row, or `undefined` when its bytes are gone or belong to another row. */
export function previewUrlOf(row: PreviewRow): string | undefined {
  const entry = previews.get(row.id)
  return entry && entry.fileName === row.fileName && entry.createdAt === row.createdAt
    ? entry.url
    : undefined
}

/** Revokes every preview whose row no longer exists (deleted, or the mock was reset and reseeded). */
export function pruneTo(rows: readonly PreviewRow[]): void {
  for (const id of [...previews.keys()]) {
    const row = rows.find((r) => r.id === id)
    if (!row || previewUrlOf(row) === undefined) drop(id)
  }
}

/** Revokes and forgets every preview URL. */
export function clearPreviews(): void {
  for (const id of [...previews.keys()]) drop(id)
}
