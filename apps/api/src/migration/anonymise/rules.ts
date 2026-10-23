/**
 * Column rules of the anonymiser (BE-35). DEFAULT DENY: every column of every table of the staging DDL
 * needs a rule, otherwise `checkCoverage` fails and the tool refuses to read a single row. A rule that
 * names a table or column that is not in the DDL is an error too (a stale rule hides a renamed column).
 *
 * Rule notation in the config file (`anon.config.json`):
 *
 *   "keep"                    the value is copied (ids, foreign keys, enums, numbers, dates, public content)
 *   "null"                    the value becomes NULL
 *   {"fixed": <json>}         a non-NULL value becomes this constant (NULL stays NULL)
 *   "scrub-text"              free text becomes `Teks anonim.`; in json every string leaf is replaced,
 *                             numbers and booleans are kept (NULL and "" stay as they are)
 *   "scrub-json"              json held in a text column: parsed, keys/numbers/booleans/null kept, every string leaf
 *                             becomes `Teks anonim.`, written back with JSON.stringify; NULL stays NULL and a value
 *                             that is not valid JSON is replaced as scrub-text would (fail closed)
 *   "hash-password-dummy"     see passwords.ts
 *   "pseudonym:<kind>"        keyed deterministic fake, kinds in pseudonyms.ts
 *
 * Lookup: `tables.<table>.<column>`, then `global.<column>` (only for columns whose meaning is the
 * same in every table: id, created_at, updated_at). Nothing else is inherited.
 *
 * NULL is never turned into a value, and "" stays "", so null ratios survive.
 */
import { columnNames, type TableSpec } from '../ddl/spec'
import { ConfigError, CoverageError } from './errors'
import { dummyPasswordHash } from './passwords'
import { PSEUDONYM_KINDS, type PseudonymKind, type Pseudonymiser } from './pseudonyms'

export type Rule =
  | { rule: 'keep' }
  | { rule: 'null' }
  | { rule: 'fixed'; value: unknown }
  | { rule: 'scrub-text' }
  | { rule: 'scrub-json' }
  | { rule: 'hash-password-dummy' }
  | { rule: 'pseudonym'; kind: PseudonymKind }

export interface AnonConfig {
  version: 1
  global: Record<string, Rule>
  tables: Record<string, Record<string, Rule>>
  /** Roles whose accounts get the usable dummy password hash. Every other role (or none) gets an unusable value. */
  dummyPasswordRoles: string[]
  /** `table.column` entries whose ORIGINAL-VALUE hits are tolerated (never pattern hits). Empty by default. */
  leakScan: { allow: string[] }
}

export const DEFAULT_DUMMY_PASSWORD_ROLES = ['pelajar', 'guru', 'ibu_bapa'] as const

export const SCRUBBED_TEXT = 'Teks anonim.'

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const PLAIN_NAME = /^[a-z][a-z0-9_]{0,62}$/

function parseRule(raw: unknown, where: string): Rule {
  if (typeof raw === 'string') {
    if (raw === 'keep' || raw === 'null' || raw === 'scrub-text' || raw === 'scrub-json' || raw === 'hash-password-dummy') return { rule: raw }
    if (raw.startsWith('pseudonym:')) {
      const kind = raw.slice('pseudonym:'.length)
      if ((PSEUDONYM_KINDS as readonly string[]).includes(kind)) return { rule: 'pseudonym', kind: kind as PseudonymKind }
      throw new ConfigError(`${where}: unknown pseudonym kind. Allowed: ${PSEUDONYM_KINDS.join(', ')}.`)
    }
    throw new ConfigError(`${where}: unknown rule. Allowed: keep, null, scrub-text, scrub-json, hash-password-dummy, pseudonym:<kind>, {"fixed": ...}.`)
  }
  if (isObject(raw) && Object.keys(raw).length === 1 && 'fixed' in raw) return { rule: 'fixed', value: raw.fixed }
  throw new ConfigError(`${where}: a rule is a string or {"fixed": value}.`)
}

/** Validates the parsed JSON of a config file. Messages name tables and columns, never values. */
export function parseConfig(json: unknown): AnonConfig {
  if (!isObject(json)) throw new ConfigError('The config must be a JSON object.')
  if (json.version !== 1) throw new ConfigError('The config "version" must be 1.')
  const extra = Object.keys(json).filter((k) => !['version', 'global', 'tables', 'dummyPasswordRoles', 'leakScan'].includes(k))
  if (extra.length > 0) throw new ConfigError(`The config has unknown top-level keys (${extra.filter((k) => PLAIN_NAME.test(k)).join(', ') || extra.length}).`)
  const parseMap = (raw: unknown, where: string): Record<string, Rule> => {
    if (!isObject(raw)) throw new ConfigError(`${where} must be an object.`)
    const out: Record<string, Rule> = {}
    for (const [column, rule] of Object.entries(raw)) {
      if (!PLAIN_NAME.test(column)) throw new ConfigError(`${where} has a column name that is not snake_case.`)
      out[column] = parseRule(rule, `${where}.${column}`)
    }
    return out
  }
  const global = json.global === undefined ? {} : parseMap(json.global, 'global')
  if (!isObject(json.tables)) throw new ConfigError('The config needs a "tables" object.')
  const tables: Record<string, Record<string, Rule>> = {}
  for (const [table, cols] of Object.entries(json.tables)) {
    if (!PLAIN_NAME.test(table)) throw new ConfigError('The config has a table name that is not snake_case.')
    tables[table] = parseMap(cols, `tables.${table}`)
  }
  let dummyPasswordRoles: string[] = [...DEFAULT_DUMMY_PASSWORD_ROLES]
  if (json.dummyPasswordRoles !== undefined) {
    if (!Array.isArray(json.dummyPasswordRoles) || !json.dummyPasswordRoles.every((r) => typeof r === 'string' && PLAIN_NAME.test(r))) {
      throw new ConfigError('dummyPasswordRoles must be a list of role codes (snake_case).')
    }
    dummyPasswordRoles = json.dummyPasswordRoles as string[]
  }
  let allow: string[] = []
  if (json.leakScan !== undefined) {
    const ls = json.leakScan
    if (!isObject(ls) || Object.keys(ls).some((k) => k !== 'allow') || (ls.allow !== undefined && (!Array.isArray(ls.allow) || !ls.allow.every((e) => typeof e === 'string' && /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(e))))) {
      throw new ConfigError('leakScan must be {"allow": ["table.column", ...]}.')
    }
    allow = (ls.allow as string[] | undefined) ?? []
  }
  return { version: 1, global, tables, dummyPasswordRoles, leakScan: { allow } }
}

export function ruleFor(config: AnonConfig, table: string, column: string): Rule | undefined {
  return config.tables[table]?.[column] ?? config.global[column]
}

export interface Coverage {
  /** `table.column` of every DDL column without a rule. */
  uncovered: string[]
  /** `table.column` named by the config but not present in the DDL. */
  unknown: string[]
}

export function findCoverageGaps(tables: readonly TableSpec[], config: AnonConfig): Coverage {
  const uncovered: string[] = []
  const known = new Map(tables.map((t) => [t.name, new Set(columnNames(t))]))
  for (const t of tables) {
    for (const c of columnNames(t)) if (!ruleFor(config, t.name, c)) uncovered.push(`${t.name}.${c}`)
  }
  const unknown: string[] = []
  for (const [table, cols] of Object.entries(config.tables)) {
    const columns = known.get(table)
    if (!columns) {
      unknown.push(`${table}.*`)
      continue
    }
    for (const c of Object.keys(cols)) if (!columns.has(c)) unknown.push(`${table}.${c}`)
  }
  for (const entry of config.leakScan.allow) {
    const [table, column] = entry.split('.')
    if (!known.get(table as string)?.has(column as string)) unknown.push(entry)
  }
  return { uncovered, unknown }
}

/** Throws a CoverageError naming every uncovered column (default deny). */
export function checkCoverage(tables: readonly TableSpec[], config: AnonConfig): void {
  const { uncovered, unknown } = findCoverageGaps(tables, config)
  if (uncovered.length === 0 && unknown.length === 0) return
  const list = (xs: string[]) => `${xs.slice(0, 30).join(', ')}${xs.length > 30 ? `, ... (${xs.length} in total)` : ''}`
  const parts: string[] = []
  if (uncovered.length > 0) parts.push(`no rule for column(s): ${list(uncovered)}`)
  if (unknown.length > 0) parts.push(`rule(s) for table/column(s) that the staging DDL does not have: ${list(unknown)}`)
  throw new CoverageError(`Refusing to run (default deny): ${parts.join('; ')}. Nothing was read.`, uncovered, unknown)
}

function scrubJson(value: unknown): unknown {
  if (typeof value === 'string') return value === '' ? '' : SCRUBBED_TEXT
  if (Array.isArray(value)) return value.map(scrubJson)
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubJson(v)]))
  return value
}

/** `scrub-json` on a text cell: parse, scrub string leaves, serialise. Not valid JSON: whole value scrubbed (fail closed). */
function scrubJsonText(value: string): string {
  if (value === '') return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return SCRUBBED_TEXT
  }
  return JSON.stringify(scrubJson(parsed))
}

/** Applies one rule to one value. `pseudo` is only needed for pseudonym rules. */
export function applyRule(rule: Rule, value: unknown, pseudo: Pseudonymiser, lockPassword = false): unknown {
  switch (rule.rule) {
    case 'keep':
      return value
    case 'null':
      return null
    case 'fixed':
      return value === null || value === undefined ? null : rule.value
    case 'scrub-text':
      if (value === null || value === undefined) return null
      if (typeof value === 'object') return scrubJson(value)
      return value === '' ? '' : SCRUBBED_TEXT
    case 'scrub-json':
      if (value === null || value === undefined) return null
      if (typeof value === 'string') return scrubJsonText(value)
      if (typeof value === 'object') return scrubJson(value)
      return SCRUBBED_TEXT
    case 'hash-password-dummy':
      return dummyPasswordHash(value, lockPassword)
    case 'pseudonym':
      return pseudo.apply(rule.kind, value)
  }
}
