/**
 * The ONE reader of a table stimulus grid (R1-T07): the Studio read model, the paper builder and the Bijak bridge all go through
 * `stimulusTableOf`, so a stored grid is shown the same everywhere.
 */
export interface StimulusTable {
  head: string[]
  rows: string[][]
}

/**
 * A table stimulus grid: the stored `tableData` (`{ head, rows }`, `{ headers, rows }`, `{ columns, rows }` or an
 * array of rows whose first row is the head), else a pipe table written in the body (`a | b` per line, an optional
 * `---` rule). Anything else is not a table (the body stays plain text, or the stimulus is a picture).
 */
export function stimulusTableOf(data: unknown, body: string | null = null): StimulusTable | undefined {
  const cell = (c: unknown): string =>
    typeof c === 'string' ? c : typeof c === 'number' ? String(c) : ''
  const rowsOf = (x: unknown): string[][] | undefined =>
    Array.isArray(x) && x.every((r) => Array.isArray(r))
      ? (x as unknown[][]).map((r) => r.map(cell))
      : undefined
  if (Array.isArray(data)) {
    const [head, ...rows] = rowsOf(data) ?? []
    if (head && head.length > 0) return { head, rows }
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const head = rowsOf([d.head ?? d.headers ?? d.columns])?.[0]
    const rows = rowsOf(d.rows)
    if (head && head.length > 0 && rows) return { head, rows }
  }
  if (body && body.includes('|')) {
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !/^\|?[\s:|-]+\|?$/.test(l))
    const cells = lines.map((l) =>
      l
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim()),
    )
    const [head, ...rows] = cells
    if (head && head.length >= 2 && rows.length >= 1 && rows.every((r) => r.length === head.length))
      return { head, rows }
  }
  return undefined
}
