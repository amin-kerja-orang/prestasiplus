/**
 * Database errors without row values (BE-NFR-11). The message, `detail` and `where` of a Postgres
 * error can quote the offending value (`invalid input syntax for type date: "..."`,
 * `Key (email)=(...) already exists`), so the kit never lets them leave: it keeps only the SQLSTATE
 * code and the names of the table, column and constraint.
 */
export class MigrationDbError extends Error {
  constructor(
    readonly code: string,
    readonly table: string | null,
    readonly column: string | null,
    readonly constraint: string | null,
  ) {
    super(describe(code, table, column, constraint))
    this.name = 'MigrationDbError'
  }
}

function describe(code: string, table: string | null, column: string | null, constraint: string | null): string {
  const where = [table && `table ${table}`, column && `column ${column}`, constraint && `constraint ${constraint}`]
    .filter(Boolean)
    .join(', ')
  return `Database error SQLSTATE ${code}${where ? ` (${where})` : ''}`
}

interface PgErrorShape {
  code: string
  severity: string
  table?: string
  column?: string
  constraint?: string
}

/** True for an error raised by the Postgres server (has a 5-character SQLSTATE and a severity). */
export function isPgError(err: unknown): err is PgErrorShape {
  if (typeof err !== 'object' || err === null) return false
  const e = err as Record<string, unknown>
  return typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) && typeof e.severity === 'string'
}

/**
 * The sanitised form of a Postgres error, or the error itself when it is not one. `fallbackTable`
 * names the target table when the server did not report one.
 */
export function sanitizeDbError(err: unknown, fallbackTable?: string): unknown {
  if (err instanceof MigrationDbError || !isPgError(err)) return err
  return new MigrationDbError(err.code, err.table ?? fallbackTable ?? null, err.column ?? null, err.constraint ?? null)
}
