#!/usr/bin/env node
// Restore drill (BE-33). Proves a backup is usable. Runbook: docs/ops/db-backup.md
//
//   npm run db:restore-check -- [--file <dump>] [--dir <backup dir>] [--target <name>_restorecheck]
//                               [--container <name>] [--keep-db]
//
// Restores into a NEW database whose name ends in "_restorecheck" on the same server, runs sanity
// queries, then drops that database (unless --keep-db). It refuses any other target name, so the
// main database can never be touched. Credentials come from the container environment.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  DEFAULT_BACKUP_DIR, FILE_PREFIX, FILE_SUFFIX, OpsError, RESTORE_SUFFIX, assertOutsideRepo, captureStderr,
  execTarget, fail, humanSize, parseArgs, runInDb, spawnInDb,
} from './lib/db-ops.mjs';

const IDENT = /^[a-z][a-z0-9_]{0,40}$/;
const CORE_TABLES = ['users', 'schools', 'sessions', 'audit_events', 'questions'];

function latest(dir) {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(FILE_PREFIX) && f.endsWith(FILE_SUFFIX))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new OpsError(`No ${FILE_PREFIX}*${FILE_SUFFIX} file in ${dir}`);
  return join(dir, files[0].f);
}

function sha256(path) {
  return new Promise((res, rej) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (d) => h.update(d)).on('error', rej).on('end', () => res(h.digest('hex')));
  });
}

const COUNT_ALL_SQL =
  "select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text " +
  "from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name";

/** Exact row count of every public base table (including _prisma_migrations): Map(table -> count). */
function countAll(target, db) {
  const out = sql(target, db, COUNT_ALL_SQL);
  return new Map(out ? out.split('\n').map((l) => l.split('|')) : []);
}

/** Run one SQL statement via stdin (no shell quoting). `db` null = the main database (read-only use). */
function sql(target, db, statement) {
  const dbArg = db === null ? '"$POSTGRES_DB"' : `'${db}'`;
  const script = `PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d ${dbArg} -v ON_ERROR_STOP=1 -At`;
  const r = runInDb(target, script, `${statement};\n`);
  if (r.status !== 0) throw new OpsError(`psql failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file
    ? String(args.file)
    : latest(assertOutsideRepo(args.dir || process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR));
  if (!existsSync(file)) throw new OpsError(`Backup file not found: ${file}`);
  assertOutsideRepo(file);

  const target = execTarget(args);
  const mainDb = sql(target, null, 'select current_database()');
  const dbName = String(args.target || `${mainDb}${RESTORE_SUFFIX}`);
  if (!IDENT.test(dbName) || !dbName.endsWith(RESTORE_SUFFIX) || dbName === mainDb) {
    throw new OpsError(
      `Refusing target "${dbName}": the restore target must be a lowercase name ending in "${RESTORE_SUFFIX}".`,
      3,
    );
  }

  const size = statSync(file).size;
  const sha = await sha256(file);
  const sidecar = `${file}.sha256`;
  if (existsSync(sidecar)) {
    const want = readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0];
    if (want !== sha) throw new OpsError('Checksum mismatch against the .sha256 file; the backup is corrupt or altered.');
    console.log('Checksum matches the .sha256 sidecar.');
  }
  console.log(`Backup: ${basename(file)}  ${humanSize(size)}  sha256 ${sha}`);
  console.log(`Restoring into throwaway database "${dbName}" via ${target.label} (main database "${mainDb}" is not touched)`);

  if (sql(target, null, `select 1 from pg_database where datname='${dbName}'`)) {
    throw new OpsError(`Database "${dbName}" already exists; drop it first or pick another --target.`);
  }
  sql(target, null, `create database ${dbName}`);

  let failed = null;
  try {
    const script = `PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d '${dbName}' --no-owner --exit-on-error`;
    const child = spawnInDb(target, script);
    const err = captureStderr(child);
    child.stdin.on('error', () => {});
    createReadStream(file).pipe(child.stdin);
    child.stdout.resume();
    const code = await new Promise((res, rej) => {
      child.on('error', rej);
      child.on('close', res);
    });
    if (code !== 0) throw new OpsError(`pg_restore failed (exit ${code}). ${err()}`);

    const tables = Number(
      sql(target, dbName, "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"),
    );
    if (!(tables > 0)) throw new OpsError('Restored database has no tables in schema public.');
    console.log(`public tables: ${tables}`);
    if (sql(target, dbName, "select to_regclass('public._prisma_migrations') is not null") === 't') {
      console.log(`_prisma_migrations rows: ${sql(target, dbName, 'select count(*) from _prisma_migrations')}`);
    } else {
      console.log('_prisma_migrations: table not present (not a Prisma database)');
    }
    for (const t of CORE_TABLES) {
      if (sql(target, dbName, `select to_regclass('public.${t}') is not null`) === 't') {
        console.log(`rows in ${t}: ${sql(target, dbName, `select count(*) from ${t}`)}`);
      }
    }

    // Compare every table of the source (main) database with the restored copy. The source must be
    // idle (no writes since the backup), otherwise a legitimate difference shows up as a mismatch.
    const src = countAll(target, null);
    const dst = countAll(target, dbName);
    const bad = [];
    let total = 0;
    for (const t of new Set([...src.keys(), ...dst.keys()])) {
      total += Number(dst.get(t) ?? 0);
      if (src.get(t) !== dst.get(t)) bad.push(`${t}: source ${src.get(t) ?? 'missing'}, restored ${dst.get(t) ?? 'missing'}`);
    }
    console.log(`row-count comparison: ${src.size} source tables, ${dst.size} restored tables, ${total} rows restored, ${bad.length} mismatches`);
    if (bad.length) throw new OpsError(`ROW-COUNT COMPARISON FAILED\n  ${bad.join('\n  ')}`);
    console.log('ROW-COUNT COMPARISON PASSED');
  } catch (e) {
    failed = e;
  } finally {
    if (args['keep-db']) {
      console.log(`Kept database ${dbName} (--keep-db). Drop it when done.`);
    } else {
      try {
        sql(target, null, `drop database if exists ${dbName}`);
        console.log(`Dropped ${dbName}.`);
      } catch (e) {
        console.error(`WARNING: could not drop ${dbName}: ${e.message}`);
      }
    }
  }
  if (failed) throw failed;
  console.log('RESTORE CHECK PASSED');
}

main().catch(fail);
