#!/usr/bin/env node
// Demo DB delta (ops, demo 2026-10-21). Runbook: docs/ops/demo-cloudflare-supabase.md, section
// "Switch Render back to feature/v2-backend".
//
//   DATABASE_URL=... node scripts/demo-db-delta.mjs [--dry-run] [--migrations-dir <path>]
//
// Brings a database up to the migrations in apps/api/prisma/migrations WITHOUT the Prisma schema engine
// (plain `pg`), the way `prisma migrate deploy` would:
// - reads `<dir>/*/migration.sql`, compares with `_prisma_migrations`, applies the missing ones in name order;
// - one transaction per migration: the SQL and its `_prisma_migrations` row commit together or not at all;
// - the row is what Prisma writes: id (uuid), checksum = sha256 hex of the file, started_at, finished_at,
//   migration_name, logs NULL, rolled_back_at NULL, applied_steps_count = 1;
// - refuses to run (applies nothing) when a recorded migration's checksum differs from its file, when a recorded
//   migration has no file, or when a recorded migration is unfinished (failed) and not rolled back;
// - `--dry-run` prints the plan and changes nothing.
// Creates `_prisma_migrations` (Prisma's own DDL) only when it does not exist (an empty database).
//
// DATABASE_URL comes from the environment only and is never printed. TLS: off for localhost/127.0.0.1/::1 or a
// unix socket, otherwise encrypted with certificate verification OFF (Supabase signs with its own CA; same
// trade-off as the seed's `sslmode=no-verify`, demo only). Any ssl* parameter in the URL is ignored.
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const DEFAULT_DIR = fileURLToPath(new URL('../apps/api/prisma/migrations/', import.meta.url))
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', ''])
// Prisma's own table (schema engine, Postgres flavour).
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
)`

class DeltaError extends Error {}

function parseArgs(argv) {
  const out = { dryRun: false, dir: DEFAULT_DIR }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--migrations-dir') {
      const v = argv[i + 1]
      if (!v || v.startsWith('--')) throw new DeltaError('--migrations-dir needs a path.')
      out.dir = resolve(v)
      i += 1
    } else if (a.startsWith('--migrations-dir='))
      out.dir = resolve(a.slice('--migrations-dir='.length))
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: DATABASE_URL=... node scripts/demo-db-delta.mjs [--dry-run] [--migrations-dir <path>]',
      )
      process.exit(0)
    } else throw new DeltaError(`Unknown argument "${a}".`)
  }
  return out
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

/**
 * Checksums a recorded row may legitimately carry for this file (raw bytes; LF or CRLF line endings), so a checkout
 * with other line endings is not refused. New rows always get the raw-bytes checksum (`sha256` of the file as read).
 */
function acceptedChecksums(buf) {
  const text = buf.toString('utf8')
  const lf = text.replace(/\r\n/g, '\n')
  return new Set([sha256(buf), sha256(lf), sha256(lf.replace(/\n/g, '\r\n'))])
}

function readMigrations(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory())
    throw new DeltaError(`Migrations folder not found: ${dir}`)
  return readdirSync(dir)
    .filter(
      (name) =>
        statSync(join(dir, name)).isDirectory() && existsSync(join(dir, name, 'migration.sql')),
    )
    .sort()
    .map((name) => {
      const buf = readFileSync(join(dir, name, 'migration.sql'))
      return {
        name,
        sql: buf.toString('utf8'),
        checksum: sha256(buf),
        accepted: acceptedChecksums(buf),
      }
    })
}

/** pg config from DATABASE_URL: ssl* query parameters removed, TLS chosen by host. Never logged. */
function clientConfig(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new DeltaError('DATABASE_URL is not a valid URL (the value is not shown).')
  }
  if (!/^postgres(ql)?:$/.test(url.protocol))
    throw new DeltaError('DATABASE_URL must start with postgresql://')
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('ssl') || key.toLowerCase() === 'uselibpqcompat')
      url.searchParams.delete(key)
  }
  const socketHost = url.searchParams.get('host')
  const local = LOCAL_HOSTS.has(url.hostname) || (socketHost !== null && socketHost.startsWith('/'))
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
    application_name: 'demo-db-delta',
    target: local ? 'local database (no TLS)' : 'remote database (TLS, certificate not verified)',
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const raw = process.env.DATABASE_URL
  if (!raw)
    throw new DeltaError(
      'DATABASE_URL is not set. Export it in this shell first (it is never printed).',
    )
  const { target, ...config } = clientConfig(raw)
  const files = readMigrations(args.dir)
  if (files.length === 0) throw new DeltaError(`No migrations in ${args.dir}`)

  const client = new pg.Client(config)
  // A dropped connection must surface as an error, not crash the process with an unhandled event.
  client.on('error', () => undefined)
  await client.connect()
  try {
    const {
      rows: [server],
    } = await client.query(
      "select current_setting('server_version') as v, current_database() as db",
    )
    console.log(`Connected: ${target}, Postgres ${server.v}, database "${server.db}".`)
    console.log(
      `Migrations folder: ${files.length} migration(s), ${files[0].name} .. ${files.at(-1).name}`,
    )

    const {
      rows: [t],
    } = await client.query("select to_regclass('public._prisma_migrations') is not null as present")
    let recorded = []
    if (t.present) {
      ;({ rows: recorded } = await client.query(
        'select migration_name, checksum, finished_at, rolled_back_at from "_prisma_migrations" order by migration_name, started_at',
      ))
    } else {
      console.log('_prisma_migrations: not present (empty database); it will be created.')
    }

    // Checks first; nothing is applied when any of them fails.
    const byName = new Map(files.map((f) => [f.name, f]))
    const applied = new Set()
    const problems = []
    for (const r of recorded) {
      if (r.rolled_back_at !== null) continue
      const file = byName.get(r.migration_name)
      if (!file)
        problems.push(
          `${r.migration_name}: recorded in the database but there is no such folder here (wrong branch?).`,
        )
      else if (r.finished_at === null)
        problems.push(
          `${r.migration_name}: recorded as started but not finished (a failed migration). Resolve it before running this script.`,
        )
      else if (!file.accepted.has(r.checksum))
        problems.push(
          `${r.migration_name}: checksum in the database differs from the file (the migration was edited after it was applied).`,
        )
      else applied.add(r.migration_name)
    }
    console.log(`_prisma_migrations: ${applied.size} applied row(s).`)
    if (problems.length > 0) {
      for (const p of problems) console.error(`REFUSED  ${p}`)
      throw new DeltaError('Nothing was applied. Fix the problem(s) above first.')
    }

    const pending = files.filter((f) => !applied.has(f.name))
    const newest = [...applied].sort().at(-1)
    for (const f of pending) {
      if (newest && f.name < newest)
        console.log(
          `note     ${f.name} sorts before the newest applied migration (${newest}); it is applied anyway (as prisma migrate deploy does).`,
        )
    }
    if (pending.length === 0) {
      console.log('Up to date: no migration to apply.')
      return
    }
    for (const f of pending)
      console.log(`${args.dryRun ? 'would apply' : 'pending'}  ${f.name}  sha256 ${f.checksum}`)
    if (args.dryRun) {
      console.log(`Dry run: ${pending.length} migration(s) would be applied. Nothing was changed.`)
      return
    }

    if (!t.present) await client.query(CREATE_TABLE)
    for (const f of pending) {
      const started = Date.now()
      await client.query('BEGIN')
      try {
        const id = randomUUID()
        await client.query(
          'insert into "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count) values ($1, $2, $3, now(), 0)',
          [id, f.checksum, f.name],
        )
        await client.query(f.sql)
        await client.query(
          'update "_prisma_migrations" set finished_at = clock_timestamp(), applied_steps_count = 1 where id = $1',
          [id],
        )
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined)
        const msg = err instanceof Error ? err.message : String(err)
        throw new DeltaError(
          `${f.name} FAILED and was rolled back (nothing of it is in the database): ${msg}`,
        )
      }
      console.log(`applied  ${f.name}  (${Date.now() - started} ms)`)
    }
    const {
      rows: [c],
    } = await client.query(
      'select count(*)::int as n from "_prisma_migrations" where finished_at is not null and rolled_back_at is null',
    )
    console.log(
      `Done: ${pending.length} migration(s) applied; _prisma_migrations now has ${c.n} applied row(s).`,
    )
  } finally {
    await client.end().catch(() => undefined)
  }
}

main().catch((err) => {
  // Our own messages never include the URL; pg errors name hosts at most. Mask the URL and password anyway.
  let msg = err instanceof Error ? err.message : String(err)
  const raw = process.env.DATABASE_URL
  if (raw) {
    msg = msg.replaceAll(raw, '<DATABASE_URL>')
    try {
      const pw = decodeURIComponent(new URL(raw).password)
      if (pw) msg = msg.replaceAll(pw, '<password>')
    } catch {
      // not a URL: already reported as such, nothing else to mask
    }
  }
  console.error(`demo-db-delta: ${msg}`)
  process.exit(1)
})
