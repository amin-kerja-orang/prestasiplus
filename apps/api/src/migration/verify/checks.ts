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
import { ARCHIVE_SCHEMA, STAGING_SCHEMA } from '../ddl/spec'
import { sanitizeDbError } from '../kit/errors'
import { quoteIdent } from '../kit/sql'
import { ROLE_MAP } from '../transform/enums'
import { buildGeo } from '../transform/reference'
import { survivorSql } from './deleted'
import { questionFileChecks, standaloneRejects } from './bank-checks'
import { capped, entityOf, exists, reported, type CheckContext } from './check-kit'
import { canonicalDetail, canonicalTotal, findingsDetail, findingsTotal, positionGapGroups, readCanonicalFindings, readGroupFindings } from './group-checks'
import { readStimulusLinkFindings, stimulusLinkDetail, stimulusLinkTotal } from './stimulus-link-checks'
import { existingLegacyTables, loadForeignKeys, readMigratableList, type ForeignKey } from './fk-graph'
import type { StatCheck } from './types'

export type { CheckContext } from './check-kit'

const S = quoteIdent(STAGING_SCHEMA)
const A = quoteIdent(ARCHIVE_SCHEMA)

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
  // Users whose source row was deleted after the load are still in v2 (the delta never deletes): leave them out here.
  const alive = await survivorSql(pool, 'users', 'x')
  const loaded = await pool.query<{ role: string; school: string | null; n: number }>(
    `SELECT r.role, s.legacy_id AS school, count(*)::int AS n
     FROM users x JOIN user_roles r ON r.user_id = x.id
     LEFT JOIN schools s ON s.id = x.school_id AND s.legacy_source = $1
     WHERE x.legacy_source = $1${alive} GROUP BY 1, 2`,
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
  // The subject of an answer is the archived question's subject, else the session's (snapshot join, BE-29); only when the staged
  // session is gone (deleted at source) does the loaded answer keep the v2 session's subject, so that is the last fallback.
  // A staged session that still exists with no subject stays "none".
  const archive = await exists(pool, ARCHIVE_SCHEMA, 'questions')
  const subjectExpr = archive ? 'coalesce(q.subject_id, ps.subject_id)' : 'ps.subject_id'
  const staged = await pool.query<{ k: string | null; n: number }>(
    `SELECT CASE WHEN ${subjectExpr} IS NOT NULL THEN m.new_id::text WHEN ps.id IS NULL THEN vs.subject_id::text END AS k, count(*)::int AS n
     FROM practice_answers pa
     JOIN ${S}."question_attempts" qa ON qa.id::text = pa.legacy_id
     ${archive ? `LEFT JOIN ${A}."questions" q ON q.id = qa.question_id` : ''}
     LEFT JOIN ${S}."practice_sessions" ps ON ps.id = qa.practice_session_id
     LEFT JOIN etl_id_map m ON m.legacy_source = $1 AND m.entity = 'subjects' AND m.legacy_id = ${subjectExpr}::text
     LEFT JOIN practice_sessions vs ON vs.id = pa.session_id
     WHERE pa.legacy_source = $1 GROUP BY 1`,
    [source],
  )
  const alive = await survivorSql(pool, 'practice_answers', 'pa')
  const loaded = await pool.query<{ k: string | null; n: number }>(
    `SELECT pa.subject_id::text AS k, count(*)::int AS n FROM practice_answers pa WHERE pa.legacy_source = $1${alive} GROUP BY 1`,
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

async function ledger({ pool, source, entities }: CheckContext): Promise<StatCheck[]> {
  const out: StatCheck[] = []

  // Wallet balance versus the sum of the user's migrated ledger rows. V3 keeps a wallet equal to its ledger; .cloud kept two independent
  // counters (a balance credited with no ledger row, as for the non-pupil wallets, rows rejected here, its own drift). The `wallet_opening`
  // step writes one `legacy_opening` ledger row per wallet its V2 ledger does not explain, so after a run EVERY wallet equals its ledger:
  // a difference is a failure (the step did not run, or a ledger row changed after it).
  const drift = await pool.query<{ wallets: number; differing: number; no_ledger: number; non_pupil: number; opening: number; opening_no_ledger: number }>(
    `SELECT count(*)::int AS wallets,
            count(*) FILTER (WHERE w.current_syiling <> coalesce(l.s, 0))::int AS differing,
            count(*) FILTER (WHERE coalesce(l.n, 0) = 0)::int AS no_ledger,
            count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = w.user_id AND r.role = 'student'))::int AS non_pupil,
            count(*) FILTER (WHERE coalesce(l.o, 0) > 0)::int AS opening,
            count(*) FILTER (WHERE coalesce(l.o, 0) > 0 AND l.n = l.o)::int AS opening_no_ledger
     FROM wallets w
     LEFT JOIN (SELECT user_id, sum(amount) AS s, count(*) AS n, count(*) FILTER (WHERE legacy_id LIKE 'opening:%') AS o
                  FROM coin_ledger WHERE legacy_source = $1 GROUP BY user_id) l ON l.user_id = w.user_id
     WHERE w.legacy_source = $1`,
    [source],
  )
  const d = drift.rows[0] ?? { wallets: 0, differing: 0, no_ledger: 0, non_pupil: 0, opening: 0, opening_no_ledger: 0 }
  const ran = entities.find((e) => e.entity === 'wallet_opening')?.status !== 'not-run'
  out.push({
    name: 'wallet balance versus ledger sum (users with a difference)',
    kind: 'sums',
    expected: 0,
    actual: d.differing,
    status: d.differing === 0 ? 'ok' : ran ? 'mismatch' : 'reported',
    detail:
      `${d.wallets} migrated wallets (${d.non_pupil} of non-pupil users, kept for the teacher economy), ${d.differing} differ from SUM(amount); ` +
      `${d.opening} carry an opening-balance row (legacy_opening), ${d.opening_no_ledger} of them with no other ledger row; ${d.no_ledger} wallets have no ledger row at all. ` +
      (ran ? 'Opening rows are the only correction: the wallet and the V2 ledger rows are never changed.' : 'The wallet_opening step has not run: the differences are only reported.'),
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
    const alive = await survivorSql(pool, 'coin_ledger', 'l')
    const loaded = await pool.query<{ s: string }>(
      `SELECT coalesce(sum(l.amount), 0)::text AS s FROM coin_ledger l WHERE l.legacy_source = $1${alive}`,
      [source],
    )
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
  const aliveSessions = await survivorSql(pool, 'practice_sessions', 'ps')
  const aliveAnswers = await survivorSql(pool, 'practice_answers', 'pa')
  const answers = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM practice_answers pa WHERE pa.legacy_source = $1 AND pa.is_correct${aliveAnswers}`,
    [source],
  )
  const actual = answers.rows[0]?.n ?? '0'
  const sumName = 'SUM(practice_sessions.correct) versus correct answer rows'
  if (!(await exists(pool, STAGING_SCHEMA, 'question_attempts'))) {
    const sessions = await pool.query<{ s: string }>(
      `SELECT coalesce(sum(ps.correct_count), 0)::text AS s FROM practice_sessions ps WHERE ps.legacy_source = $1${aliveSessions}`,
      [source],
    )
    return [
      {
        name: sumName,
        kind: 'sums',
        expected: sessions.rows[0]?.s ?? '0',
        actual,
        status: 'reported',
        detail: 'staging_cloud.question_attempts is not available: the session counters are shown against the answer rows, not compared',
      },
    ]
  }
  // A session whose V2 answer rows exist must add up: its stored counter is the number of its correct rows. A V2 session without any answer row
  // (the SPM tracking sessions store the score, not the answers) has nothing to compare; its counter is listed apart, never added to the expectation.
  const sessions = await pool.query<{ s: string; n: number; uncomparable_sum: string; uncomparable: number }>(
    `SELECT coalesce(sum(ps.correct_count) FILTER (WHERE has.yes), 0)::text AS s, count(*) FILTER (WHERE has.yes)::int AS n,
            coalesce(sum(ps.correct_count) FILTER (WHERE NOT has.yes), 0)::text AS uncomparable_sum, count(*) FILTER (WHERE NOT has.yes)::int AS uncomparable
       FROM practice_sessions ps
       CROSS JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM ${S}."question_attempts" a WHERE a.practice_session_id::text = ps.legacy_id) AS yes) has
      WHERE ps.legacy_source = $1${aliveSessions}`,
    [source],
  )
  const r = sessions.rows[0] ?? { s: '0', n: 0, uncomparable_sum: '0', uncomparable: 0 }
  // The loader reads every answer of a loaded session; the correct ones staged must equal the correct ones loaded (no silent loss).
  const staged = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${S}."question_attempts" a
      WHERE lower(btrim(a.is_correct)) IN ('1', 'true', 't', 'yes', 'y', 'ya')
        AND EXISTS (SELECT 1 FROM practice_sessions ps WHERE ps.legacy_source = $1 AND ps.legacy_id = a.practice_session_id::text${aliveSessions})`,
    [source],
  )
  const expectedRows = staged.rows[0]?.n ?? '0'
  return [
    {
      name: sumName,
      kind: 'sums',
      expected: r.s,
      actual,
      // A difference is V2's own counter drift (the row is the truth the pupil sees), shown and not failed; the loss check below fails.
      status: r.s === actual ? 'ok' : 'reported',
      detail: `${r.n} loaded sessions have answer rows (counter sum ${r.s}); ${r.uncomparable} loaded sessions have none in V2 (counter sum ${r.uncomparable_sum}, not comparable)`,
    },
    {
      name: 'correct answer rows versus staged correct attempts (loaded sessions)',
      kind: 'sums',
      expected: expectedRows,
      actual,
      status: expectedRows === actual ? 'ok' : 'mismatch',
      detail: 'every staged attempt of a loaded session is loaded: the correct rows staged and loaded are equal',
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
  // Children of a parent whose source row was deleted stay in v2 with it (the delta never deletes): both sides of every
  // comparison below leave them out. A role, scope or profile has the legacy id of its user, a result that of its attempt.
  const user = (alias: string): Promise<string> => survivorSql(pool, 'users', alias)
  const users = await n(`SELECT count(*)::int AS n FROM users u WHERE u.legacy_source = $1${await user('u')}`)
  const roles = await n(`SELECT count(*)::int AS n FROM user_roles u WHERE u.legacy_source = $1${await user('u')}`)
  const scopes = await n(`SELECT count(*)::int AS n FROM user_scopes u WHERE u.legacy_source = $1${await user('u')}`)
  const teachers = await n(`SELECT count(*)::int AS n FROM teacher_profiles u WHERE u.legacy_source = $1${await user('u')}`)
  const results = await n(
    `SELECT count(*)::int AS n FROM attempt_results r JOIN exam_attempts a ON a.id = r.attempt_id
     WHERE a.legacy_source = $1${await survivorSql(pool, 'exam_attempts', 'a')}`,
  )
  const attempts = await n(`SELECT count(*)::int AS n FROM exam_attempts a WHERE a.legacy_source = $1${await survivorSql(pool, 'exam_attempts', 'a')}`)

  // Exact rules of the transform: a national scope for every admin, a district scope for a ppd_officer whose school has a
  // state and a district, a state scope for a ppd_officer that came from the staged role `jpn_officer` when its school has a
  // state (`transformUser`). The inputs are the loaded rows themselves, so deleting scope rows is caught. The staged role is
  // read only to tell a JPN officer from a PPD officer; without it every officer is judged by the district rule.
  const stagedUsers = await exists(pool, STAGING_SCHEMA, 'users')
  const jpn = stagedUsers
    ? `coalesce(lower(regexp_replace(btrim(su.role::text), '[\\s-]+', '_', 'g')) = 'jpn_officer', false)`
    : 'false'
  const scopeRule = await n(
    `SELECT count(*)::int AS n FROM users x JOIN user_roles r ON r.user_id = x.id LEFT JOIN schools s ON s.id = x.school_id
     ${stagedUsers ? `LEFT JOIN ${S}."users" su ON su.id::text = x.legacy_id` : ''}
     WHERE x.legacy_source = $1${await user('x')}
       AND (r.role = 'admin' OR (r.role = 'ppd_officer' AND s.state IS NOT NULL AND (${jpn} OR s.district IS NOT NULL)))`,
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
      detail: 'one national scope per admin, one district scope per ppd_officer whose school has a state and a district, one state scope per JPN officer whose school has a state',
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
    // V2 keeps streak_days as a counter that nothing resets between the dump and the load; v3 recomputes the streak from the sessions as of the load
    // day (current = 0 when the last practice day is older than yesterday). A stored value above 0 against a recomputed 0 is that lapse: expected drift.
    // Anything else (both above 0 and different, or a recomputed streak above a stored 0) has no explanation and is listed apart.
    const res = await pool.query<{ total: number; differing: number; lapsed: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE w.streak_days IS NOT NULL AND w.streak_days <> s."current")::int AS differing,
              count(*) FILTER (WHERE w.streak_days > 0 AND s."current" = 0)::int AS lapsed
         FROM ${S}."student_wallets" w JOIN streaks s ON s.legacy_source = $1 AND s.legacy_id = w.id::text`,
      [source],
    )
    const r = res.rows[0] ?? { total: 0, differing: 0, lapsed: 0 }
    out.push({
      name: 'streak: stored streak_days versus recomputed current streak',
      kind: 'accepted-drift',
      expected: r.lapsed,
      actual: r.differing,
      status: r.lapsed === r.differing ? 'ok' : 'reported',
      detail: `${r.differing} of ${r.total} migrated wallets differ: ${r.lapsed} stored a streak above 0 that has lapsed by the load day (recomputed 0), ${r.differing - r.lapsed} unexplained; streaks are recomputed in v2 (T-05, risk "Derived data drift")`,
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

// ---------------------------------------------------------------- (h) question bank, papers: the standalone loaders


/**
 * "V2 total = loaded + absorbed + quarantined + the type another loader owns" (design 5.1, V-2): every archive question row is accounted
 * for. The rows `migrate:questions` leaves out are rajah carriers (one `c:` stimulus each in the id map) and the subjective type (the rows
 * `subjective_questions` reads); the difference between that and what the step excluded must be zero.
 */
async function questionsAccounting({ pool, source, entities }: CheckContext): Promise<StatCheck[]> {
  const name = 'questions: V2 total = loaded + absorbed + quarantined + other loader'
  const q = entityOf(entities, 'questions')
  if (q === undefined) return [reported(name, 'counts', 'migrate:questions has no succeeded apply run; not compared')]
  const subj = entityOf(entities, 'subjective_questions')
  const stim = entityOf(entities, 'question_stimuli')
  if (subj === undefined || stim === undefined) {
    return [
      reported(
        name,
        'counts',
        `${q.sourceCount} V2 rows, ${q.loaded} loaded, ${q.rejected} quarantined; ${q.sourceCount - q.eligibleCount} excluded (carriers and subjective): the subjective or stimulus step has no succeeded apply run, so the split is not compared`,
      ),
    ]
  }
  const carriers = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM etl_id_map WHERE legacy_source = $1 AND entity = 'question_stimuli' AND legacy_id LIKE 'c:%'`,
    [source],
  )
  const absorbed = carriers.rows[0]?.n ?? 0
  const otherLoader = subj.sourceCount
  const unexplained = q.sourceCount - (q.loaded + absorbed + q.rejected + otherLoader)
  return [
    {
      name,
      kind: 'counts',
      expected: q.sourceCount,
      actual: q.loaded + absorbed + q.rejected + otherLoader,
      status: unexplained === 0 ? 'ok' : 'mismatch',
      detail: `V2 ${q.sourceCount} = loaded ${q.loaded} + absorbed carriers ${absorbed} + quarantined ${q.rejected} + subjective (other loader) ${otherLoader}; unexplained ${unexplained}`,
    },
  ]
}

/** Stimulus groups: every group of the id map still exists, has its stimulus and at least one member (a group is never split or left empty). */
async function stimulusGroupChecks({ pool, source, entities }: CheckContext): Promise<StatCheck[]> {
  const name = 'stimulus groups: groups with a stimulus and members'
  if (entityOf(entities, 'stimulus_groups') === undefined) return [reported(name, 'orphans', 'migrate:questions has no succeeded apply run; not compared')]
  const res = await pool.query<{ groups: number; dangling: number; no_stimulus: number; no_member: number; held: number }>(
    `SELECT count(*)::int AS groups,
            count(*) FILTER (WHERE sg.id IS NULL)::int AS dangling,
            count(*) FILTER (WHERE sg.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM stimulus_group_stimuli x WHERE x.group_id = sg.id))::int AS no_stimulus,
            count(*) FILTER (WHERE sg.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.group_id = sg.id))::int AS no_member,
            count(*) FILTER (WHERE sg.id IS NOT NULL AND EXISTS (SELECT 1 FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = 1
                                                               WHERE q.group_id = sg.id AND NOT q.is_active
                                                                 AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb))::int AS held
     FROM etl_id_map m LEFT JOIN stimulus_groups sg ON sg.id = m.new_id::bigint
     WHERE m.legacy_source = $1 AND m.entity = 'stimulus_groups'`,
    [source],
  )
  const r = res.rows[0] ?? { groups: 0, dangling: 0, no_stimulus: 0, no_member: 0, held: 0 }
  const bad = r.dangling + r.no_stimulus + r.no_member
  return [
    {
      name,
      kind: 'orphans',
      expected: 0,
      actual: bad,
      status: bad === 0 ? 'ok' : 'mismatch',
      detail: `${r.groups} groups: ${r.dangling} deleted, ${r.no_stimulus} without a stimulus, ${r.no_member} without a member; ${r.held} held as a whole until their picture is copied`,
    },
  ]
}

/**
 * Stimulus groups versus V2 (M-D): member count, `group_position` 1..n in V2 order with no gap, every planned member in its group, no split. The
 * expectation is the rajah plan recomputed from the V2 archive (see `group-checks.ts`). Any difference is a `mismatch`, never only reported.
 */
async function stimulusGroupPlanChecks({ pool, source, entities }: CheckContext): Promise<StatCheck[]> {
  const name = 'stimulus groups: members, order and completeness versus the V2 plan'
  if (entityOf(entities, 'stimulus_groups') === undefined) return [reported(name, 'orphans', 'migrate:questions has no succeeded apply run; not compared')]
  if (!(await exists(pool, ARCHIVE_SCHEMA, 'questions'))) return [reported(name, 'orphans', 'archive_cloud.questions is not available; the plan cannot be recomputed, not compared')]
  const findings = await readGroupFindings(pool, source)
  const gaps = await positionGapGroups(pool, source)
  const canonicalReady = (await exists(pool, ARCHIVE_SCHEMA, 'question_stimulus')) && (await exists(pool, ARCHIVE_SCHEMA, 'exam_questions')) && (await exists(pool, ARCHIVE_SCHEMA, 'question_parts'))
  const canonical = canonicalReady ? await readCanonicalFindings(pool, source) : null
  const links = canonicalReady && (await exists(pool, ARCHIVE_SCHEMA, 'stimuli')) ? await readStimulusLinkFindings(pool, source) : null
  const bad = findingsTotal(findings) + gaps.gaps + (canonical === null ? 0 : canonicalTotal(canonical)) + (links === null ? 0 : stimulusLinkTotal(links))
  return [
    {
      name,
      kind: 'orphans',
      expected: 0,
      actual: bad,
      status: bad === 0 ? 'ok' : 'mismatch',
      detail: `${findingsDetail(findings)}; group_position 1..n without a gap in ${gaps.groups - gaps.gaps} of ${gaps.groups} groups of the id maps; ${canonical === null ? 'canonical stimulus tables are not available: canonical links not compared' : canonicalDetail(canonical)}; ${links === null ? 'stimuli table is not available: V2 stimulus links not compared' : stimulusLinkDetail(links)}`,
    },
  ]
}

/** PKSK (OC-4): every loaded V2 question carries its domain and level tags, and none is live (served) without options. */
async function pkskChecks({ pool, source, entities }: CheckContext): Promise<StatCheck[]> {
  const name = 'PKSK questions: tags and draft state'
  if (entityOf(entities, 'pksk_questions') === undefined) return [reported(name, 'counts', 'the pksk_questions step has not run (migrate:structured); not compared')]
  const res = await pool.query<{ loaded: number; untagged: number; served_empty: number; drafts_to_complete: number }>(
    `SELECT count(*)::int AS loaded,
            count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM question_tags t WHERE t.question_id = q.id AND t.kind = 'pksk_domain')
                              OR NOT EXISTS (SELECT 1 FROM question_tags t WHERE t.question_id = q.id AND t.kind = 'pksk_level'))::int AS untagged,
            count(*) FILTER (WHERE q.live_version_no IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM question_versions v JOIN question_parts pt ON pt.question_version_id = v.id JOIN part_options o ON o.part_id = pt.id
                 WHERE v.question_id = q.id AND v.version_no = q.live_version_no))::int AS served_empty,
            count(*) FILTER (WHERE q.live_version_no IS NULL AND NOT EXISTS (
                SELECT 1 FROM question_versions v JOIN question_parts pt ON pt.question_version_id = v.id JOIN part_options o ON o.part_id = pt.id
                 WHERE v.question_id = q.id AND v.version_no = q.latest_version_no))::int AS drafts_to_complete
     FROM etl_id_map m JOIN questions q ON q.id = m.new_id::bigint
     WHERE m.legacy_source = $1 AND m.entity = 'pksk_questions'`,
    [source],
  )
  const r = res.rows[0] ?? { loaded: 0, untagged: 0, served_empty: 0, drafts_to_complete: 0 }
  const bad = r.untagged + r.served_empty
  return [
    {
      name,
      kind: 'counts',
      expected: 0,
      actual: bad,
      status: bad === 0 ? 'ok' : 'mismatch',
      detail: `${r.loaded} loaded V2 PKSK questions: ${r.untagged} without a domain or level tag, ${r.served_empty} live with no options; ${r.drafts_to_complete} still have no options and wait for an admin in "Soalan PKSK" (never served)`,
    },
  ]
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
  ['questions accounting', questionsAccounting],
  ['stimulus groups', stimulusGroupChecks],
  ['stimulus groups versus V2', stimulusGroupPlanChecks],
  ['question pictures', questionFileChecks],
  ['PKSK questions', pkskChecks],
  ['loader rejects', standaloneRejects],
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
