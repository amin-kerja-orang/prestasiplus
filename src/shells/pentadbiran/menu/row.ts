/** One fragment row: doc id, label, target route (omitted = not built) and optional sub-heading. */
export type Row = readonly [id: string, label: string, to?: string, sub?: string]
