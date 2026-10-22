/**
 * Semantic checks of `migrate:verify` (plan 14.6, card BE-30 Outputs): sums, distinct sets, distributions, orphans and
 * accepted drift, on top of the per-entity row counts.
 *
 * Aggregates and surrogate ids only. No query selects a name, e-mail, IC, phone, free text or hash; the only staged
 * columns read are ids, enum-like codes (`users.role`) and numbers. A database error never reaches the report with its
 * message (it can quote a value): `sanitizeDbError` keeps the SQLSTATE and the table / column / constraint names.
 *
 * Population rule: a staging-versus-v2 comparison runs over the rows that WERE loaded (the staging row has a v2 row with
 * the same `legacy_id`). The rows that were not loaded are the rejects, and they are counted by the entity table, so a
 * check never fails twice for the same reject.
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA, STAGING_SCHEMA } from '../ddl/spec'
import { sanitizeDbError } from '../kit/errors'
import { quoteIdent } from '../kit/sql'
import type { LegacySource } from '../kit/types'
import { ROLE_MAP } from '../transform/enums'
import { buildGeo } from '../transform/reference'
import { existingLegacyTables, loadForeignKeys, readMigratableList, type ForeignKey } from './fk-graph'
import type { EntityCheck, StatCheck } from './types'

const S = quoteIdent(STAGING_SCHEMA)
const A = quoteIdent(ARCHIVE_SCHEMA)
const MAX_DETAIL_ITEMS = 20

export interface CheckContext {
  pool: pg.Pool
  source: LegacySource
  entities: readonly EntityCheck[]
}

/** True when `schema.table` exists (so a check can say "not available" instead of failing on a missing relation). */
async function exists(pool: pg.Pool, schema: string | null, table: string): Promise<boolean> {
  const name = schema === null ? quoteIdent(table) : `${quoteIdent(schema)}.${quoteIdent(table)}`
  const res = await pool.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [name])
  return res.rows[0]?.ok === true
}

const reported = (name: string, kind: StatCheck['kind'], detail: string): StatCheck => ({
  name,
  kind,
  expected: null,
  actual: null,
  status: 'reported',
  detail,
})

/** Compares two count maps; returns the differing keys as `key: expected / actual` (capped). */
function diffMaps(expected: ReadonlyMap<string, number>, actual: ReadonlyMap<string, number>): string[] {
  const keys = [...new Set([...expected.keys(), ...actual.keys()])].sort()
  const out: string[] = []
  for (const k of keys) {
    const x = expected.get(k) ?? 0
    const y = actual.get(k) ?? 0
    if (x !== y) out.push(`${k}: staging ${x}, v2 ${y}`)
  }
  return out
}

const sumOf = (m: ReadonlyMap<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0)

const capped = (items: readonly string[]): string =>
  items.length <= MAX_DETAIL_ITEMS ? items.join('; ') : `${items.slice(0, MAX_DETAIL_ITEMS).join('; ')}; ... (${items.length} in all)`

function countMap(rows: readonly { k: string | null; n: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.k ?? 'none', (m.get(r.k ?? 'none') ?? 0) + Number(r.n))
  return m
}

// ---------------------------------------------------------------- (a) users per role per school

async function usersPerRolePerSchool({ pool, source }: CheckContext): Promise<StatCheck[]> {
  const name = 'users per role per school (loaded users)'
  if (!(await exists(pool, STAGING_SCHEMA, 'users'))) return [reported(name, 'counts', 'staging_cloud.users is not available; not compared')]
  const staged = await pool.query<{ role: string | null; school: string | null; n: number }>(
    `SELECT lower(regexp_replace(btrim(u.role), '[\\s-]+', '_', 'g')) AS role, u.school_id::text AS school, count(*)::int AS n
     FROM ${S}."users" u
     WHERE EXISTS (SELECT 1 FROM users x WHERE x.legacy_source = $1 AND x.legacy_id = u.id::text)
     GROUP BY 1, 2`,
    [source],
  )
  const loaded = await pool.query<{ role: string; school: string | null; n: number }>(
    `SELECT r.role, s.legacy_id AS school, count(*)::int AS n
     FROM users x JOIN user_roles r ON r.user_id = x.id
     LEFT JOIN schools s ON s.id = x.school_id AND s.legacy_source = $1
     WHERE x.legacy_source = $1 GROUP BY 1, 2`,
    [source],
  )
  // A staged role word is printed only through the allow-list of mapped roles; anything else is `unmapped(other)`.
  const roleLabel = (raw: string | null): string => (raw !== null && Object.hasOwn(ROLE_MAP, raw) ? (ROLE_MAP[raw] as string) : 'unmapped(other)')
  const expected = countMap(staged.rows.map((r) => ({ k: `${roleLabel(r.role)} | school ${r.school ?? 'none'}`, n: r.n })))
  const actual = countMap(loaded.rows.map((r) => ({ k: `${r.role} | school ${r.school ?? 'none'}`, n: r.n })))
  const diff = diffMaps(expected, actual)
  return [
    {
      name,
      kind: 'counts',
      expected: sumOf(expected),
      actual: sumOf(actual),
      status: diff.length === 0 ? 'ok' : 'mismatch',
      detail: diff.length === 0 ? `${expected.size} (role, school) groups equal` : capped(diff),
    },
  ]
}

// ---------------------------------------------------------------- (b) answers per subject

async function answersPerSubject({ pool, source }: CheckContext): Promise<StatCheck[]> {
  const name = 'practice answers per subject (loaded answers)'
  if (!(await exists(pool, STAGING_SCHEMA, 'question_attempts'))) {
    return [reported(name, 'distribution', 'staging_cloud.question_attempts is not available; not compared')]
  }
  // The subject of an answer is the archived question's subject, else the session's (snapshot join, BE-29).
  const archive = await exists(pool, ARCHIVE_SCHEMA, 'questions')
  const subjectExpr = archive ? 'coalesce(q.subject_id, ps.subject_id)' : 'ps.subject_id'
  const staged = await pool.query<{ k: string | null; n: number }>(
    `SELECT m.new_id AS k, count(*)::int AS n
     FROM practice_answers pa
     JOIN ${S}."question_attempts" qa ON qa.id::text = pa.legacy_id
     ${archive ? `LEFT JOIN ${A}."questions" q ON q.id = qa.question_id` : ''}
     LEFT JOIN ${S}."practice_sessions" ps ON ps.id = qa.practice_session_id
     LEFT JOIN etl_id_map m ON m.legacy_source = $1 AND m.entity = 'subjects' AND m.legacy_id = ${subjectExpr}::text
     WHERE pa.legacy_source = $1 GROUP BY 1`,
    [source],
  )
  const loaded = await pool.query<{ k: string | null; n: number }>(
    `SELECT subject_id::text AS k, count(*)::int AS n FROM practice_answers WHERE legacy_source = $1 GROUP BY 1`,
    [source],
  )
  const expected = countMap(staged.rows.map((r) => ({ k: `subject ${r.k ?? 'none'}`, n: r.n })))
  const actual = countMap(loaded.rows.map((r) => ({ k: `subject ${r.k ?? 'none'}`, n: r.n })))
  const diff = diffMaps(expected, actual)
  return [
    {
      name,
      kind: 'distribution',
      expected: sumOf(expected),
      actual: sumOf(actual),
      status: diff.length === 0 ? 'ok' : 'mismatch',
      detail: diff.length === 0 ? `${expected.size} subjects, same count in each` : capped(diff),
    },
  ]
}

// ---------------------------------------------------------------- (c) ledger

async function ledger({ pool, source }: CheckContext): Promise<StatCheck[]> {
  const out: StatCheck[] = []

  // Wallet balance versus the sum of the user's migrated ledger rows: .cloud keeps two independent counters, so a
  // difference is REPORTED (risk "Ledger integrity"); nothing is corrected and this never fails the run.
  const drift = await pool.query<{ with_ledger: number; differing: number; without_ledger: number }>(
    `SELECT count(l.user_id)::int AS with_ledger,
            count(l.user_id) FILTER (WHERE w.current_syiling <> l.s)::int AS differing,
            count(*) FILTER (WHERE l.user_id IS NULL)::int AS without_ledger
     FROM wallets w
     LEFT JOIN (SELECT user_id, sum(amount) AS s FROM coin_ledger WHERE legacy_source = $1 GROUP BY user_id) l ON l.user_id = w.user_id
     WHERE w.legacy_source = $1`,
    [source],
  )
  const d = drift.rows[0] ?? { with_ledger: 0, differing: 0, without_ledger: 0 }
  out.push({
    name: 'wallet balance versus ledger sum (users with a difference)',
    kind: 'sums',
    expected: 0,
    actual: d.differing,
    status: 'reported',
    detail: `${d.with_ledger} wallets have migrated ledger rows, ${d.differing} of them differ from SUM(amount); ${d.without_ledger} wallets have no ledger rows. Reported, never corrected.`,
  })

  // Staging sum versus v2 sum of the ledger amount over the loaded rows.
  if (!(await exists(pool, STAGING_SCHEMA, 'coin_transactions'))) {
    out.push(reported('ledger amount sum, staging versus v2', 'sums', 'staging_cloud.coin_transactions is not available; not compared'))
  } else {
    const staged = await pool.query<{ s: string }>(
      `SELECT coalesce(sum(t.amount), 0)::text AS s FROM ${S}."coin_transactions" t
       WHERE EXISTS (SELECT 1 FROM coin_ledger l WHERE l.legacy_source = $1 AND l.legacy_id = t.id::text)`,
      [source],
    )
    const loaded = await pool.query<{ s: string }>(`SELECT coalesce(sum(amount), 0)::text AS s FROM coin_ledger WHERE legacy_source = $1`, [source])
    const expected = staged.rows[0]?.s ?? '0'
    const actual = loaded.rows[0]?.s ?? '0'
    out.push({
      name: 'ledger amount sum, staging versus v2',
      kind: 'sums',
      expected,
      actual,
      status: expected === actual ? 'ok' : 'mismatch',
    })
  }
  return out
}

// ---------------------------------------------------------------- (d) correct answers

async function correctAnswers({ pool, source }: CheckContext): Promise<StatCheck[]> {
  const sessions = await pool.query<{ s: string }>(
    `SELECT coalesce(sum(correct_count), 0)::text AS s FROM practice_sessions WHERE legacy_source = $1`,
    [source],
  )
  const answers = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM practice_answers WHERE legacy_source = $1 AND is_correct`,
    [source],
  )
  return [
    {
      name: 'SUM(practice_sessions.correct) versus correct answer rows',
      kind: 'sums',
      expected: sessions.rows[0]?.s ?? '0',
      actual: answers.rows[0]?.n ?? '0',
      status: 'reported',
      detail: 'A session counts answers that may have been rejected (orphan question, unknown user); a difference is shown, not failed.',
    },
  ]
}

// ---------------------------------------------------------------- (e) JPN / PPD

async function geography({ pool, entities }: CheckContext): Promise<StatCheck[]> {
  if (!(await exists(pool, STAGING_SCHEMA, 'schools'))) {
    return [reported('distinct state / district pairs versus JPN / PPD rows', 'distinct', 'staging_cloud.schools is not available; not compared')]
  }
  // Same normalisation as `CoreContext.geo`, so the expected sets are the ones the loader derives.
  const pairs = await pool.query<{ state: string | null; district: string | null; n: number }>(
    `SELECT nullif(btrim(regexp_replace(state, '\\s+', ' ', 'g')), '') AS state,
            nullif(btrim(regexp_replace(district, '\\s+', ' ', 'g')), '') AS district, count(*)::int AS n
     FROM ${S}."schools" GROUP BY 1, 2`,
  )
  const geo = buildGeo(pairs.rows)
  const out: StatCheck[] = []
  for (const [entity, expected] of [['jpns', geo.jpns.length], ['ppds', geo.ppds.length]] as const) {
    const row = entities.find((x) => x.entity === entity)
    const actual = row?.targetCount ?? null
    const rejected = row?.rejected ?? 0
    out.push({
      name: entity === 'jpns' ? 'distinct states versus JPN rows' : 'distinct (state, district) pairs versus PPD rows',
      kind: 'distinct',
      expected,
      actual,
      // A derived row the loader rejected (a code clash with another row) is accounted for by the entity table.
      status: actual !== null && actual + rejected === expected ? 'ok' : 'mismatch',
      detail: rejected > 0 ? `${rejected} derived row(s) rejected by the loader` : undefined,
    })
  }
  return out
}

// ---------------------------------------------------------------- (f) orphans

/** SQL counting the migrated child rows of `fk` whose referenced parent row does not exist (a NULL column is not a reference). */
export function orphanSql(fk: ForeignKey): string {
  const notNull = fk.childCols.map((c) => `c.${quoteIdent(c)} IS NOT NULL`).join(' AND ')
  const match = fk.childCols.map((c, i) => `p.${quoteIdent(fk.parentCols[i] as string)} = c.${quoteIdent(c)}`).join(' AND ')
  return `SELECT count(*)::int AS n FROM ${quoteIdent(fk.child)} c
          WHERE c.legacy_source = $1 AND ${notNull}
            AND NOT EXISTS (SELECT 1 FROM ${quoteIdent(fk.parent)} p WHERE ${match})`
}

async function orphans({ pool, source }: CheckContext): Promise<StatCheck[]> {
  const legacy = new Set(await existingLegacyTables(pool, readMigratableList()))
  const fks = (await loadForeignKeys(pool)).filter((f) => legacy.has(f.child))
  const failing: string[] = []
  let total = 0
  for (const fk of fks) {
    const res = await pool.query<{ n: number }>(orphanSql(fk), [source])
    const n = res.rows[0]?.n ?? 0
    if (n > 0) {
      total += n
      failing.push(`${fk.child}.${fk.childCols.join('+')} -> ${fk.parent}: ${n}`)
    }
  }
  const out: StatCheck[] = [
    {
      name: 'orphan rows per foreign key of the migrated tables',
      kind: 'orphans',
      expected: 0,
      actual: total,
      status: total === 0 ? 'ok' : 'mismatch',
      detail:
        (total === 0 ? `${fks.length} foreign keys scanned, no orphan` : capped(failing)) +
        '. A column with a real foreign key can show an orphan only if the constraint is NOT VALID or disabled; the live rule is the soft reference on practice answers.',
    },
  ]
  // Soft reference by design (no FK to the question): an answer needs the question OR its curriculum subject (plan 14.5 item 2).
  const soft = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM practice_answers WHERE legacy_source = $1 AND question_id IS NULL AND subject_id IS NULL`,
    [source],
  )
  const n = soft.rows[0]?.n ?? 0
  out.push({
    name: 'practice answers with neither question nor subject',
    kind: 'orphans',
    expected: 0,
    actual: n,
    status: n === 0 ? 'ok' : 'mismatch',
  })
  return out
}

// ---------------------------------------------------------------- derived rows that share a legacy id

async function derivedCounts({ pool, source }: CheckContext): Promise<StatCheck[]> {
  const n = async (sql: string): Promise<number> => (await pool.query<{ n: number }>(sql, [source])).rows[0]?.n ?? 0
  const users = await n(`SELECT count(*)::int AS n FROM users WHERE legacy_source = $1`)
  const roles = await n(`SELECT count(*)::int AS n FROM user_roles WHERE legacy_source = $1`)
  const scopes = await n(`SELECT count(*)::int AS n FROM user_scopes WHERE legacy_source = $1`)
  const teachers = await n(`SELECT count(*)::int AS n FROM teacher_profiles WHERE legacy_source = $1`)
  const results = await n(
    `SELECT count(*)::int AS n FROM attempt_results r JOIN exam_attempts a ON a.id = r.attempt_id WHERE a.legacy_source = $1`,
  )
  const attempts = await n(`SELECT count(*)::int AS n FROM exam_attempts WHERE legacy_source = $1`)

  // Exact rules of the transform: a national scope for every admin, a district scope for a ppd_officer whose school has a
  // state and a district (`transformUser`). The inputs are the loaded rows themselves, so deleting scope rows is caught.
  const scopeRule = await n(
    `SELECT count(*)::int AS n FROM users x JOIN user_roles r ON r.user_id = x.id LEFT JOIN schools s ON s.id = x.school_id
     WHERE x.legacy_source = $1 AND (r.role = 'admin' OR (r.role = 'ppd_officer' AND s.state IS NOT NULL AND s.district IS NOT NULL))`,
  )
  const out: StatCheck[] = [
    {
      name: 'user_roles rows versus users (one role per user)',
      kind: 'counts',
      expected: users,
      actual: roles,
      status: roles === users ? 'ok' : 'mismatch',
    },
    {
      name: 'user_scopes rows versus admins and scoped officers',
      kind: 'counts',
      expected: scopeRule,
      actual: scopes,
      status: scopes === scopeRule ? 'ok' : 'mismatch',
      detail: 'one national scope per admin, one district scope per ppd_officer whose school has a state and a district',
    },
  ]

  // The teacher profile and the attempt result depend on staged columns: the loaded rows that have the input must have the output.
  if (!(await exists(pool, STAGING_SCHEMA, 'users'))) {
    out.push(reported('teacher_profiles rows versus teachers with profile data', 'counts', 'staging_cloud.users is not available; not compared'))
  } else {
    const blank = (c: string): string => `nullif(btrim(regexp_replace(u.${c}::text, '\\s+', ' ', 'g')), '') IS NOT NULL`
    const expected = await n(
      `SELECT count(*)::int AS n FROM ${S}."users" u
       WHERE EXISTS (SELECT 1 FROM users x JOIN user_roles r ON r.user_id = x.id AND r.role = 'teacher'
                     WHERE x.legacy_source = $1 AND x.legacy_id = u.id::text)
         AND (${blank('teaching_subject')} OR ${blank('teaching_qualification')} OR ${blank('teaching_experience_years')})`,
    )
    out.push({
      name: 'teacher_profiles rows versus teachers with profile data',
      kind: 'counts',
      expected,
      actual: teachers,
      status: teachers === expected ? 'ok' : 'mismatch',
      detail: 'a teacher gets a profile when the staged row has a subject, a qualification or an experience value',
    })
  }
  if (!(await exists(pool, STAGING_SCHEMA, 'exam_attempts'))) {
    out.push(reported('attempt_results rows versus scored exam attempts', 'counts', 'staging_cloud.exam_attempts is not available; not compared'))
  } else {
    const expected = await n(
      `SELECT count(*)::int AS n FROM ${S}."exam_attempts" a
       WHERE EXISTS (SELECT 1 FROM exam_attempts x WHERE x.legacy_source = $1 AND x.legacy_id = a.id::text)
         AND nullif(btrim(a.score::text), '') IS NOT NULL AND nullif(btrim(a.max_score::text), '') IS NOT NULL`,
    )
    out.push({
      name: 'attempt_results rows versus scored exam attempts',
      kind: 'counts',
      expected,
      actual: results,
      status: results === expected ? 'ok' : 'mismatch',
      detail: `an attempt without a score or a maximum has no result row (${attempts} migrated attempts)`,
    })
  }
  return out
}

// ---------------------------------------------------------------- (g) accepted drift

async function acceptedDrift({ pool, source }: CheckContext): Promise<StatCheck[]> {
  const out: StatCheck[] = []
  if (await exists(pool, STAGING_SCHEMA, 'student_wallets')) {
    const res = await pool.query<{ total: number; differing: number }>(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE w.streak_days IS DISTINCT FROM s."current")::int AS differing
       FROM ${S}."student_wallets" w JOIN streaks s ON s.legacy_source = $1 AND s.legacy_id = w.id::text`,
      [source],
    )
    const r = res.rows[0] ?? { total: 0, differing: 0 }
    out.push({
      name: 'streak: stored streak_days versus recomputed current streak',
      kind: 'accepted-drift',
      expected: 0,
      actual: r.differing,
      status: 'reported',
      detail: `${r.differing} of ${r.total} migrated wallets; streaks are recomputed in v2 (T-05, risk "Derived data drift")`,
    })
  } else {
    out.push(reported('streak: stored streak_days versus recomputed current streak', 'accepted-drift', 'staging_cloud.student_wallets is not available; not compared'))
  }
  const mastery = (await exists(pool, null, 'mastery'))
    ? (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM mastery`)).rows[0]?.n ?? 0
    : null
  out.push({
    name: 'mastery: recomputed in v2, not migrated',
    kind: 'accepted-drift',
    expected: 0,
    actual: mastery,
    status: 'reported',
    detail: 'rows in the mastery table (built from answers after the cutover; none is loaded by the ETL)',
  })
  out.push(reported('rankings: recomputed in v2, not migrated', 'accepted-drift', 'leaderboards are computed from the migrated sessions and answers; no ranking table is loaded'))
  return out
}

const CHECKS: readonly [string, (ctx: CheckContext) => Promise<StatCheck[]>][] = [
  ['users per role per school', usersPerRolePerSchool],
  ['answers per subject', answersPerSubject],
  ['ledger', ledger],
  ['correct answers', correctAnswers],
  ['geography', geography],
  ['orphans', orphans],
  ['derived counts', derivedCounts],
  ['accepted drift', acceptedDrift],
]

/** Runs every check. A check that cannot run is a `mismatch` (it must not pass silently); the cause is sanitised. */
export async function runChecks(ctx: CheckContext): Promise<StatCheck[]> {
  const out: StatCheck[] = []
  for (const [label, check] of CHECKS) {
    try {
      out.push(...(await check(ctx)))
    } catch (err) {
      const safe = sanitizeDbError(err)
      out.push({
        name: label,
        kind: 'counts',
        expected: null,
        actual: null,
        status: 'mismatch',
        detail: `the check could not run: ${safe instanceof Error ? safe.message : 'unknown error'}`,
      })
    }
  }
  return out
}
