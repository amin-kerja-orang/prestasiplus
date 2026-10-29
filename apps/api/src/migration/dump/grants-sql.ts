/**
 * `dump:grants` (AM-10): prints the SQL the DATA OWNER runs to create the read-only account for the export. No connection,
 * no option file. The grants are column-level: the account can read exactly the spec columns, minus the `redact` columns
 * (the export selects NULL for those, so the account never needs them) and nothing else.
 *
 * With column-level grants only, `information_schema.columns` shows only the granted columns and COUNT(*) still works, so
 * dump:check and dump:cloud run as usual; a spec column the account cannot see is reported as "missing or not granted".
 * SHOW VIEW cannot be granted per column and is not needed.
 */
import type { TableSpec } from '../ddl/spec'
import { assertIdentifier, quoteIdent } from './export-sql'
import { DumpUsageError } from './errors'

const ACCOUNT = /^'([A-Za-z0-9_.-]{1,32})'@'([A-Za-z0-9_.:%-]{1,255})'$/

export function assertDatabaseName(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new DumpUsageError('--database must be a plain name ([A-Za-z0-9_]).')
  return name
}

export function assertAccount(account: string): string {
  if (!ACCOUNT.test(account)) {
    throw new DumpUsageError(`--account must look like 'user'@'host' (letters, digits and _ . - in the user; letters, digits and _ . : % - in the host; no quotes or backslashes inside).`)
  }
  return account
}

export function buildGrantScript(database: string, account: string, specs: readonly TableSpec[]): string[] {
  assertDatabaseName(database)
  assertAccount(account)
  const lines: string[] = [
    '-- Read-only account for the .cloud export (AM-10). Run as the data owner. Replace the password placeholder (including the < >) with a quoted strong password first; run unedited it is a syntax error.',
    '-- Column-level SELECT only: the spec columns minus the redacted ones (those are exported as NULL).',
    '-- A GRANT for a table that does not exist in your database fails: skip that line ONLY when the table is absent from the database.',
    '-- Never skip the `articles` line: skipping it migrates 0 articles silently. A GRANT that fails on a column (for example articles excerpt or content) means the spec and the database disagree: STOP and report the column names to the LEAD.',
    `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY <<SET-A-STRONG-PASSWORD>> REQUIRE SSL;`,
  ]
  for (const t of specs) {
    const cols = t.columns.filter((c) => !c.redact).map((c) => quoteIdent(c.name))
    if (cols.length === 0) continue
    lines.push(`GRANT SELECT (${cols.join(', ')}) ON ${quoteIdent(database)}.${quoteIdent(assertIdentifier(t.name))} TO ${account};`)
  }
  lines.push(
    '',
    '-- If you need to check column names first, run this with your own access (metadata only, no rows):',
    `-- SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = '${database}' ORDER BY table_name, ordinal_position;`,
  )
  return lines
}
