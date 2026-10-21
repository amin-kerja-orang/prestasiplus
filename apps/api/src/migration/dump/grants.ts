/**
 * Grant check for the .cloud MySQL account (AM-10). The export must run as a READ-ONLY account; this is
 * the first guard (the READ ONLY transaction in export-sql.ts is the second).
 *
 * Allow-list (privileges that cannot change data or schema and cannot read anything beyond the tables):
 *   USAGE, SELECT (also column-level SELECT), SHOW VIEW, SHOW DATABASES.
 * Everything else is refused: ALL PRIVILEGES, INSERT/UPDATE/DELETE, any DDL, INDEX, REFERENCES, EXECUTE, TRIGGER, EVENT,
 * FILE, SUPER, GRANT OPTION, CREATE USER, RELOAD, SHUTDOWN, routines, temporary tables, PROXY, dynamic privileges (e.g.
 * BINLOG_ADMIN), LOCK TABLES (not needed for a consistent snapshot; it lets the account block writes), and also PROCESS
 * (it shows other sessions' queries and so their data), REPLICATION CLIENT and BINLOG MONITOR. A role grant
 * (`GRANT role TO user`) or any line that cannot be parsed counts as unverifiable and is refused, so is an empty grant list.
 *
 * Both the MySQL 5.7/8 format (`GRANT SELECT ON `db`.* TO 'u'@'h'`) and the MariaDB format are parsed.
 * Only privilege names are ever reported: the grant text (user, host, password hash) is never kept.
 */

export const ALLOWED_PRIVILEGES: readonly string[] = ['USAGE', 'SELECT', 'SHOW VIEW', 'SHOW DATABASES']

export interface GrantVerdict {
  readOnly: boolean
  /** Every privilege name seen (sorted, unique). */
  privileges: string[]
  /** The privilege names that are not on the allow-list (sorted, unique). */
  refused: string[]
  /** Lines that could not be verified (role grants, unknown format) and an empty list. */
  unverifiable: number
}

const GRANT_LINE = /^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+(.*)$/is
const QUOTED_IDENT = /`(?:[^`]|``)*`/g
const QUOTED_STRING = /'(?:[^'\\]|\\.|'')*'/g

const normalise = (name: string): string => name.trim().replace(/\s+/g, ' ').toUpperCase()

export function evaluateGrants(lines: readonly string[]): GrantVerdict {
  const seen = new Set<string>()
  const refused = new Set<string>()
  let unverifiable = 0
  let grantLines = 0

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') continue
    // A partial revoke (MySQL 8) only narrows the account.
    if (/^REVOKE\s/i.test(line)) continue
    if (!/^GRANT\s/i.test(line)) {
      unverifiable++
      continue
    }
    grantLines++
    const stripped = line.replace(QUOTED_IDENT, '``')
    const m = GRANT_LINE.exec(stripped)
    if (!m) {
      // `GRANT role TO user` (no ON): a role we cannot expand.
      unverifiable++
      continue
    }
    const privileges = (m[1] as string)
      .replace(/\([^)]*\)/g, '') // column lists: SELECT (`a`, `b`)
      .split(',')
      .map(normalise)
      .filter(Boolean)
    for (const p of privileges) {
      seen.add(p)
      if (p === 'ALL' || p === 'ALL PRIVILEGES' || !ALLOWED_PRIVILEGES.includes(p)) refused.add(p === 'ALL' ? 'ALL PRIVILEGES' : p)
    }
    const tail = (m[3] as string).replace(QUOTED_STRING, "''")
    if (/\bWITH\b(?:\s+\w+\s+\d+)*\s+GRANT\s+OPTION\b/i.test(tail) || /\bGRANT\s+OPTION\b/i.test(tail)) {
      seen.add('GRANT OPTION')
      refused.add('GRANT OPTION')
    }
  }
  if (grantLines === 0) unverifiable++

  return {
    readOnly: refused.size === 0 && unverifiable === 0,
    privileges: [...seen].sort(),
    refused: [...refused].sort(),
    unverifiable,
  }
}

/** One sentence for the exit-3 message. Privilege names only. */
export function describeVerdict(v: GrantVerdict): string {
  const parts: string[] = []
  if (v.refused.length > 0) parts.push(`it holds privileges beyond read-only: ${v.refused.join(', ')}`)
  if (v.unverifiable > 0) parts.push(`${v.unverifiable} grant line(s) could not be verified (roles or an unknown format)`)
  return parts.join('; ')
}
