// Removes the test school and test pupils made by seed-test-pupils.cjs, and every row they caused, in ONE transaction.
// Guide: deploy/vps/loadtest/README.md, section "Event simulation (400 pupils)".
//
// Same way of running as the seed (inside the deployed api container, scripts passed over stdin into /tmp, no rebuild):
//
//   docker exec -i pretasiplus-api-1 sh -c 'umask 077; cat > /tmp/lt-cleanup.cjs' < deploy/vps/loadtest/cleanup-test-pupils.cjs
//   docker exec -e LT_SEED_CONFIRM=LT-UJIAN-BEBAN pretasiplus-api-1 node /tmp/lt-cleanup.cjs --dry-run    # per-table counts, writes nothing
//   docker exec -e LT_SEED_CONFIRM=LT-UJIAN-BEBAN pretasiplus-api-1 node /tmp/lt-cleanup.cjs              # the real run
//
// How it finds the rows: the test school is the root (users.school_id). The script reads the foreign keys of the
// live database (pg_constraint), walks them from `users` and `schools` through every ON DELETE CASCADE edge, and counts
// the rows each table holds for the test pupils (practice sessions, checks, answers, revision, mastery, Bijak attempts,
// wallet, coin ledger, streak, notifications, auth sessions, gamification, ...). The delete is then `DELETE users`
// (+ subscription + school), and Postgres cascades. The few tables where a foreign key only SETS NULL (so the row would
// survive) are deleted explicitly (SET_NULL_OWNED below). Any other table that would keep a row pointing at a test
// pupil or at the school makes the script STOP before it writes anything (a tripwire for data it does not know).
// The coin ledger is append-only by trigger, but the trigger allows the delete once the user row is gone, which is the cascade.
// Not removed: `login_attempts` rows (keyed hashes, they expire within 60 s to 15 min).
//
// Environment: LT_SEED_CONFIRM (required, = school code, default LT-UJIAN-BEBAN), LT_SCHOOL_CODE, LT_APP_DIR, DATABASE_URL.
// Flag: --dry-run. Safe to run twice (the second run finds no school and exits 0).
'use strict'
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose: it is piped into the container and run as /tmp/*.cjs with require() of the image's node_modules */

const { createRequire } = require('node:module')

function appRequireOf(name) {
  const bases = [process.env.LT_APP_DIR, '/app/apps/api', '/app', process.cwd()].filter(Boolean)
  for (const b of bases) {
    try {
      return createRequire(`${b.replace(/\/+$/, '')}/package.json`)(name)
    } catch (e) {
      if (!e || e.code !== 'MODULE_NOT_FOUND') throw e
    }
  }
  throw new Error(`cannot find module ${name} under ${bases.join(', ')}`)
}
const { Client } = appRequireOf('pg')

const DRY = process.argv.includes('--dry-run')
const SCHOOL_CODE = process.env.LT_SCHOOL_CODE || 'LT-UJIAN-BEBAN'
const SCHOOL_NAME = 'Sekolah Ujian Beban (LT)'

// Tables whose foreign key to a test pupil / the school is SET NULL (or has no cascade) but whose rows belong to the test.
// Deleted explicitly, with the where-clause given. `U` is the test user id list, `S` the school id.
const SET_NULL_OWNED = {
  audit_events: (U, S) =>
    `actor_user_id IN (${U}) OR scope_school_id = ${S} OR (target_type = 'school' AND target_id = '${S}') OR (target_type = 'user' AND target_id IN (SELECT id::text FROM users WHERE school_id = ${S}))`,
  files: (U) => `owner_user_id IN (${U})`,
  import_jobs: (U, S) => `created_by_id IN (${U}) OR school_id = ${S}`,
  ai_usage_logs: (U) => `actor_user_id IN (${U})`,
  ai_extraction_runs: (U) => `requested_by_id IN (${U})`,
  intake_extraction_runs: (U) => `requested_by_id IN (${U})`,
}
// Edges that are handled by the delete order itself and are not a surprise.
const HANDLED_EDGES = new Set(['users.school_id', 'school_subscriptions.school_id', 'user_scopes.school_id', 'users.pending_school_id', 'users.created_by_id'])

function die(msg, code = 1) {
  console.error(`cleanup-test-pupils: ${msg}`)
  process.exit(code)
}
if (!/^LT-[A-Z0-9-]{3,40}$/.test(SCHOOL_CODE)) die('LT_SCHOOL_CODE must look like LT-UJIAN-BEBAN.')
if (process.env.LT_SEED_CONFIRM !== SCHOOL_CODE) die(`set LT_SEED_CONFIRM=${SCHOOL_CODE} to confirm. Nothing was touched.`)
if (!process.env.DATABASE_URL) die('DATABASE_URL is not set (run this inside the api container).')

const q = (s) => `"${s.replace(/"/g, '""')}"`

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query("SET LOCAL statement_timeout = '300s'")
    await db.query("SET LOCAL lock_timeout = '20s'")

    const school = (await db.query('SELECT id, name FROM schools WHERE lower(code) = lower($1)', [SCHOOL_CODE])).rows[0]
    if (!school) {
      console.log(JSON.stringify({ result: 'nothing to clean: no school with that code', schoolCode: SCHOOL_CODE }))
      await db.query('ROLLBACK')
      return
    }
    if (school.name !== SCHOOL_NAME) die(`school ${SCHOOL_CODE} is not the test school (name differs). Refusing.`)
    const S = String(school.id)
    if (!/^\d+$/.test(S)) die('unexpected school id.')

    // Safety: only fictitious pupils may live in this school.
    const odd = (
      await db.query(
        `SELECT count(*)::int AS n FROM users u
          WHERE u.school_id = $1
            AND (u.username IS NULL OR u.username !~ '^lt-pupil-[0-9]{4}$'
                 OR EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role <> 'student')
                 OR NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'student'))`,
        [school.id],
      )
    ).rows[0].n
    if (odd > 0) die(`${odd} user(s) in the test school are not plain lt-pupil-NNNN pupils. Refusing; nothing was touched.`)

    const U = `SELECT id FROM users WHERE school_id = ${S}`
    const pupils = (await db.query(`SELECT count(*)::int AS n FROM users WHERE school_id = ${S}`)).rows[0].n

    // ---- discover: single-column foreign keys of the live schema ----
    const fks = (
      await db.query(`
        SELECT c.conrelid::regclass::text AS child, ca.attname AS ccol, c.confrelid::regclass::text AS parent, pa.attname AS pcol,
               c.confdeltype AS act, c.conname
          FROM pg_constraint c
          JOIN pg_attribute ca ON ca.attrelid = c.conrelid AND ca.attnum = c.conkey[1]
          JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
         WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND c.connamespace = 'public'::regnamespace`)
    ).rows
    const multi = (await db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE contype='f' AND array_length(conkey,1) > 1 AND connamespace='public'::regnamespace`)).rows[0].n

    // where[table] = list of { sql, via } meaning "rows of table that cascade away with the test data"
    const where = new Map()
    const add = (t, cond) => {
      const list = where.get(t) || []
      if (list.some((x) => x.key === cond.key)) return false
      list.push(cond)
      where.set(t, list)
      return true
    }
    add('users', { key: 'root', sql: `school_id = ${S}`, via: 'root' })
    add('schools', { key: 'root', sql: `id = ${S}`, via: 'root' })
    const queue = ['users', 'schools']
    const nonCascade = [] // FKs from a table to a test-reachable table where the row would survive
    let guard = 0
    while (queue.length && guard++ < 500) {
      const parent = queue.shift()
      const parentWhere = where.get(parent).map((c) => `(${c.sql})`).join(' OR ')
      for (const fk of fks.filter((f) => f.parent === parent)) {
        if (fk.child === parent) continue // self reference (users.created_by_id)
        const sql = `${q(fk.ccol)} IN (SELECT ${q(fk.pcol)} FROM ${q(parent)} WHERE ${parentWhere})`
        if (fk.act === 'c') {
          if (add(fk.child, { key: fk.conname, sql, via: `${fk.child}.${fk.ccol}` })) queue.push(fk.child)
        } else {
          nonCascade.push({ table: fk.child, col: fk.ccol, act: { a: 'NO ACTION', r: 'RESTRICT', n: 'SET NULL', d: 'SET DEFAULT' }[fk.act], sql })
        }
      }
    }

    // ---- count ----
    const report = []
    for (const [t, conds] of where) {
      if (t === 'users' || t === 'schools') continue
      const n = (await db.query(`SELECT count(*)::int AS n FROM ${q(t)} WHERE ${conds.map((c) => `(${c.sql})`).join(' OR ')}`)).rows[0].n
      if (n > 0) report.push({ table: t, rows: n, how: 'cascade' })
    }
    report.push({ table: 'users', rows: pupils, how: 'delete' })
    report.push({ table: 'schools', rows: 1, how: 'delete' })
    const subs = (await db.query(`SELECT count(*)::int AS n FROM school_subscriptions WHERE school_id = ${S}`)).rows[0].n
    if (subs) report.push({ table: 'school_subscriptions', rows: subs, how: 'delete' })

    // ---- tripwire + explicit deletes ----
    const explicit = []
    const unexpected = []
    const seen = new Set()
    for (const e of nonCascade) {
      const id = `${e.table}.${e.col}`
      if (seen.has(id) || HANDLED_EDGES.has(id)) continue
      seen.add(id)
      // Rows of a table that also cascade away through another foreign key (practice_attempt_aggregates: user cascades, school sets null) are already covered.
      const covered = where.has(e.table) ? ` AND NOT (${where.get(e.table).map((c) => `(${c.sql})`).join(' OR ')})` : ''
      const n = (await db.query(`SELECT count(*)::int AS n FROM ${q(e.table)} WHERE ${e.sql}${covered}`)).rows[0].n
      if (n === 0) continue
      if (SET_NULL_OWNED[e.table]) continue // counted below
      unexpected.push({ table: e.table, column: e.col, action: e.act, rows: n })
    }
    for (const [t, f] of Object.entries(SET_NULL_OWNED)) {
      const exists = (await db.query(`SELECT to_regclass($1) AS r`, [`public.${t}`])).rows[0].r
      if (!exists) continue
      const w = f(U, S)
      const n = (await db.query(`SELECT count(*)::int AS n FROM ${q(t)} WHERE ${w}`)).rows[0].n
      if (n > 0) {
        explicit.push({ table: t, where: w })
        report.push({ table: t, rows: n, how: 'delete (explicit: FK only sets null)' })
      }
    }
    // user_scopes.school_id is RESTRICT: only the test pupils' own scope rows may point at the school.
    const strayScopes = (await db.query(`SELECT count(*)::int AS n FROM user_scopes WHERE school_id = ${S} AND user_id NOT IN (${U})`)).rows[0].n
    if (strayScopes) unexpected.push({ table: 'user_scopes', column: 'school_id', action: 'RESTRICT', rows: strayScopes })

    report.sort((a, b) => a.table.localeCompare(b.table))
    console.log(JSON.stringify({ dryRun: DRY, schoolCode: SCHOOL_CODE, pupils, multiColumnForeignKeysNotWalked: multi }))
    for (const r of report) console.log(`${r.table.padEnd(32)} ${String(r.rows).padStart(8)}  ${r.how}`)
    if (unexpected.length) {
      console.error('STOP: rows of tables this script does not own still point at the test pupils or school:')
      for (const u of unexpected) console.error(`  ${u.table}.${u.column} (${u.action}): ${u.rows} row(s)`)
      await db.query('ROLLBACK')
      die('nothing was deleted. Investigate these tables first.', 2)
    }
    if (DRY) {
      await db.query('ROLLBACK')
      console.log('dry run: nothing was deleted.')
      return
    }

    // ---- delete ----
    for (const e of explicit) await db.query(`DELETE FROM ${q(e.table)} WHERE ${e.where}`)
    await db.query(`DELETE FROM users WHERE school_id = ${S}`) // cascades to every child counted above
    await db.query(`DELETE FROM school_subscriptions WHERE school_id = ${S}`)
    await db.query(`DELETE FROM schools WHERE id = ${S}`)

    // ---- verify inside the transaction, then commit ----
    const left = (
      await db.query(`SELECT (SELECT count(*) FROM users WHERE school_id = ${S})::int AS users,
                             (SELECT count(*) FROM schools WHERE id = ${S})::int AS schools,
                             (SELECT count(*) FROM users WHERE username ~ '^lt-pupil-[0-9]{4}$')::int AS lt_users`)
    ).rows[0]
    if (left.users || left.schools || left.lt_users) throw new Error(`verification failed: ${JSON.stringify(left)}`)
    await db.query('COMMIT')
    console.log('deleted and committed.')
  } catch (err) {
    await db.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await db.end().catch(() => undefined)
  }
}

main().catch((err) => {
  console.error(`cleanup-test-pupils: failed, transaction rolled back: ${err && err.message ? err.message : 'unknown error'}`)
  process.exit(1)
})
