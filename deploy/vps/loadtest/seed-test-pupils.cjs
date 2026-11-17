// Seeds ONE fictitious test school and N fictitious pupils for the event simulation (event-load-sim.k6.js).
// Guide: deploy/vps/loadtest/README.md, section "Event simulation (400 pupils)".
//
// Runs inside the DEPLOYED api container, with no rebuild. It needs only what the runtime image already holds
// (`pg` and `@node-rs/argon2` under /app/node_modules) and the DATABASE_URL already in the container environment.
// The container root is read-only, so the script and the password file go in over stdin into /tmp (a tmpfs):
//
//   docker exec -i pretasiplus-api-1 sh -c 'umask 077; cat > /tmp/lt-seed.cjs' < deploy/vps/loadtest/seed-test-pupils.cjs
//   docker exec -i pretasiplus-api-1 sh -c 'umask 077; cat > /tmp/lt-pass' < /root/lt/pass      # one line, the pupils' password
//   docker exec -e LT_SEED_CONFIRM=LT-UJIAN-BEBAN -e LT_PASSWORD_FILE=/tmp/lt-pass -e LT_ACCOUNTS_OUT=/tmp/lt-accounts.json \
//       pretasiplus-api-1 node /tmp/lt-seed.cjs --dry-run        # counts only; then the same without --dry-run
//
// Environment (names only):
//   LT_SEED_CONFIRM     required, must equal the school code (default LT-UJIAN-BEBAN): the deliberate act
//   LT_PASSWORD_FILE    required for a real run: a file holding ONE line, the password of every test pupil (min 12 characters).
//                       It is hashed with the app's own argon2id parameters (apps/api/src/modules/auth/argon2-params.ts).
//                       The password is never printed and never written anywhere by this script.
//   LT_ACCOUNTS_OUT     path of the identifiers file written by a real run: JSON ["lt-pupil-0001", ...], no password in it (default /tmp/lt-accounts.json)
//   LT_PUPILS           how many pupils (default 400, max 1000); also --count=N
//   LT_SCHOOL_CODE      default LT-UJIAN-BEBAN (must start with LT-)
//   LT_GRADES           comma list of users.grade values, handed out in turn (default 10,11 = Tingkatan 4 and 5)
//   LT_PACKAGE_CODE     school_packages.code the test subscription uses (default T5)
//   LT_SUB_DAYS         days the test subscription stays valid, counted from today (default 14)
//   LT_APP_DIR          where node_modules is found (default /app/apps/api)
//   DATABASE_URL        already set in the container (the API's own role, pp_app)
//   --dry-run           read-only: prints what would be created (counts only) and writes nothing
//
// Idempotent: a second run creates nothing new, refreshes the password hash and the subscription dates.
// Everything it creates hangs off the one school row (users.school_id), which is how cleanup-test-pupils.cjs finds it again.
'use strict'
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose: it is piped into the container and run as /tmp/*.cjs with require() of the image's node_modules */

const fs = require('node:fs')
const { createRequire } = require('node:module')

// Find the libraries the way the API finds them: the workspace hoists them to /app/node_modules, so try the api folder, then /app.
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

// Same parameters as apps/api/src/modules/auth/argon2-params.ts (OWASP argon2id minimum). Keep in step with that file.
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 }

const DRY = process.argv.includes('--dry-run')
const num = (name, def) => (process.env[name] !== undefined && process.env[name] !== '' ? Number(process.env[name]) : def)
const argCount = (process.argv.find((a) => a.startsWith('--count=')) || '').slice(8)
const PUPILS = argCount ? Number(argCount) : num('LT_PUPILS', 400)
const SCHOOL_CODE = process.env.LT_SCHOOL_CODE || 'LT-UJIAN-BEBAN'
const SCHOOL_NAME = 'Sekolah Ujian Beban (LT)'
const PACKAGE_CODE = process.env.LT_PACKAGE_CODE || 'T5'
const SUB_DAYS = num('LT_SUB_DAYS', 14)
const GRADES = (process.env.LT_GRADES || '10,11').split(',').map((g) => Number(g.trim()))
const OUT = process.env.LT_ACCOUNTS_OUT || '/tmp/lt-accounts.json'
const SUB_MARK = 'LT-LOAD-TEST'

function die(msg) {
  console.error(`seed-test-pupils: ${msg}`)
  process.exit(1)
}

if (!/^LT-[A-Z0-9-]{3,40}$/.test(SCHOOL_CODE)) die('LT_SCHOOL_CODE must look like LT-UJIAN-BEBAN (LT- prefix, upper case).')
if (process.env.LT_SEED_CONFIRM !== SCHOOL_CODE) die(`set LT_SEED_CONFIRM=${SCHOOL_CODE} to confirm. Nothing was touched.`)
if (!Number.isInteger(PUPILS) || PUPILS < 1 || PUPILS > 1000) die('LT_PUPILS must be an integer from 1 to 1000.')
if (!GRADES.length || GRADES.some((g) => !Number.isInteger(g) || g < 1 || g > 11)) die('LT_GRADES must be integers from 1 to 11.')
if (!process.env.DATABASE_URL) die('DATABASE_URL is not set (run this inside the api container).')

const pad = (n) => String(n).padStart(4, '0')
const identifierOf = (n) => `lt-pupil-${pad(n)}`

function readPassword() {
  if (!process.env.LT_PASSWORD_FILE) {
    if (DRY) return null
    die('set LT_PASSWORD_FILE to a file holding one line (the pupils password).')
  }
  let raw
  try {
    raw = fs.readFileSync(process.env.LT_PASSWORD_FILE, 'utf8')
  } catch {
    die('LT_PASSWORD_FILE cannot be read.')
  }
  const pw = raw.trim() // the file holds one line; whitespace around it (the trailing newline) is not part of the password
  if (pw.includes('\n')) die('LT_PASSWORD_FILE must hold exactly one line.')
  if (pw.length < 12 || pw.length > 128) die('the password in LT_PASSWORD_FILE must be 12 to 128 characters.')
  return pw
}

async function main() {
  const password = readPassword()
  let passwordHash = null
  if (password !== null && !DRY) {
    const { hash } = appRequireOf('@node-rs/argon2')
    passwordHash = await hash(password, ARGON2_OPTIONS)
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  const out = { dryRun: DRY, schoolCode: SCHOOL_CODE, pupilsWanted: PUPILS }
  try {
    await db.query('BEGIN')
    await db.query("SET LOCAL statement_timeout = '60s'")

    const pkg = (await db.query('SELECT id FROM school_packages WHERE code = $1 AND is_active', [PACKAGE_CODE])).rows[0]
    if (!pkg) die(`school package ${PACKAGE_CODE} (active) not found: the catalogue is not seeded. Nothing was written.`)

    let school = (await db.query('SELECT id, name FROM schools WHERE lower(code) = lower($1)', [SCHOOL_CODE])).rows[0]
    out.schoolExists = !!school
    if (school && school.name !== SCHOOL_NAME) die(`school ${SCHOOL_CODE} exists but is not the test school (name differs). Refusing.`)

    // Usernames must not collide with anybody outside the test school: login looks a username up across all schools.
    const clash = (
      await db.query(
        `SELECT count(*)::int AS n FROM users WHERE lower(username) LIKE 'lt-pupil-%' AND school_id IS DISTINCT FROM $1`,
        [school ? school.id : null],
      )
    ).rows[0].n
    if (clash > 0) die(`${clash} user(s) outside the test school already use an lt-pupil-* username. Refusing.`)

    const existing = school
      ? (await db.query('SELECT lower(username) AS u FROM users WHERE school_id = $1', [school.id])).rows.map((r) => r.u)
      : []
    const have = new Set(existing)
    const foreign = existing.filter((u) => !/^lt-pupil-\d{4}$/.test(u))
    if (foreign.length) die(`the test school holds ${foreign.length} user(s) that are not lt-pupil-NNNN. Refusing.`)
    const missing = []
    for (let n = 1; n <= PUPILS; n++) if (!have.has(identifierOf(n))) missing.push(n)
    out.pupilsExisting = existing.length
    out.pupilsToCreate = missing.length

    if (!DRY) {
      if (!school) {
        school = (
          await db.query(
            `INSERT INTO schools (name, code, type, is_active, created_at, updated_at)
             VALUES ($1, $2, 'SMK', true, now(), now()) RETURNING id, name`,
            [SCHOOL_NAME, SCHOOL_CODE],
          )
        ).rows[0]
      }
      // The subscription makes the pupils "subscribed" (SubscriptionService): without it each pupil has a 50 question trial.
      const sub = (await db.query('SELECT id FROM school_subscriptions WHERE school_id = $1 AND payment_reference = $2', [school.id, SUB_MARK])).rows[0]
      const days = `CURRENT_DATE + ${Math.max(1, Math.floor(SUB_DAYS))}`
      if (sub) {
        await db.query(
          `UPDATE school_subscriptions SET status = 'active', starts_on = CURRENT_DATE - 1, ends_on = ${days}, student_quota = $2, updated_at = now() WHERE id = $1`,
          [sub.id, Math.max(PUPILS, 1)],
        )
      } else {
        await db.query(
          `INSERT INTO school_subscriptions (school_id, school_package_id, package_tier, student_quota, status, starts_on, ends_on, payment_reference, notes, created_at, updated_at)
           VALUES ($1, $2, 'full', $3, 'active', CURRENT_DATE - 1, ${days}, $4, 'Load test only. Remove with cleanup-test-pupils.cjs.', now(), now())`,
          [school.id, pkg.id, Math.max(PUPILS, 1), SUB_MARK],
        )
      }

      // Pupils, in batches. username = identifier; no e-mail, no IC, no phone. grade decides which Bijak papers are listed.
      for (let i = 0; i < missing.length; i += 100) {
        const batch = missing.slice(i, i + 100)
        const names = batch.map((n) => `Murid Ujian Beban ${pad(n)}`)
        const users = batch.map(identifierOf)
        const grades = batch.map((n) => GRADES[(n - 1) % GRADES.length])
        const labels = grades.map((g) => `${g - 6} LT`)
        await db.query(
          `INSERT INTO users (name, username, password_hash, school_id, grade, class_label, is_active, is_suspended, must_reset_password, created_at, updated_at)
           SELECT t.name, t.username, $5, $1, t.grade, t.label, true, false, false, now(), now()
             FROM unnest($2::text[], $3::text[], $4::int[], $6::text[]) AS t(name, username, grade, label)`,
          [school.id, names, users, grades, passwordHash, labels],
        )
      }
      // Same password for every test pupil (re-run with a new password file refreshes it).
      await db.query('UPDATE users SET password_hash = $2, must_reset_password = false, is_active = true, is_suspended = false, updated_at = now() WHERE school_id = $1', [school.id, passwordHash])
      await db.query(
        `INSERT INTO user_roles (user_id, role, created_at)
         SELECT u.id, 'student', now() FROM users u WHERE u.school_id = $1
         ON CONFLICT (user_id, role) DO NOTHING`,
        [school.id],
      )
      const total = (await db.query('SELECT count(*)::int AS n FROM users WHERE school_id = $1', [school.id])).rows[0].n
      out.pupilsTotal = total
      if (total < PUPILS) throw new Error(`only ${total} pupils exist after the insert`)
    }

    await db.query(DRY ? 'ROLLBACK' : 'COMMIT')

    if (!DRY) {
      const ids = []
      for (let n = 1; n <= PUPILS; n++) ids.push(identifierOf(n))
      fs.writeFileSync(OUT, JSON.stringify(ids), { mode: 0o600 })
      out.identifiersFile = OUT
    }
    console.log(JSON.stringify(out))
  } catch (err) {
    await db.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await db.end().catch(() => undefined)
  }
}

main().catch((err) => {
  // Never print a connection string or the password: only the message of the error.
  console.error(`seed-test-pupils: failed: ${err && err.message ? err.message : 'unknown error'}`)
  process.exit(1)
})
