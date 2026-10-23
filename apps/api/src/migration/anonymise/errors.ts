/** Error classes of the anonymiser. Messages carry table names, column names and counts only, never a value. */

export class AnonymiseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** The command line or the environment is wrong (also: no key). */
export class AnonymiseUsageError extends AnonymiseError {}

/** The HMAC key is missing, too short, or stored where it must not be. */
export class KeyError extends AnonymiseUsageError {}

/** The rules file is malformed. */
export class ConfigError extends AnonymiseUsageError {}

/** Default deny: a column of the staging DDL has no rule (or a rule names a column that does not exist). */
export class CoverageError extends AnonymiseError {
  constructor(
    message: string,
    readonly uncovered: readonly string[],
    readonly unknown: readonly string[],
  ) {
    super(message)
  }
}

/** The output location is not acceptable (not under .migration-out, not empty, overlaps the source). */
export class OutputError extends AnonymiseError {}

/** The run was interrupted through `AnonymiseOptions.signal`; the partial output was deleted. */
export class AnonymiseAbortedError extends AnonymiseError {}

/** The input carries something the tool must not guess about (a column that is not in the DDL, a bad row). */
export class InputError extends AnonymiseError {}

export interface LeakHit {
  table: string
  column: string
  /** `email`, `phone`, `ic`, `original-value`, ... */
  kind: string
  count: number
}

/** The post-run scan found something that looks like personal data. Carries places and counts, never values. */
export class LeakScanError extends AnonymiseError {
  constructor(
    readonly hits: readonly LeakHit[],
    deleted = false,
  ) {
    const shown = hits.slice(0, 20).map((h) => `${h.table}.${h.column} (${h.kind}) x${h.count}`)
    super(
      `Leak scan failed: ${hits.length} column/kind pair(s) hold personal-looking data: ${shown.join('; ')}${hits.length > 20 ? `; ... (${hits.length} in total)` : ''}.${deleted ? ' The output was deleted.' : ''}`,
    )
  }
}
