#!/usr/bin/env node
// PostgreSQL backup (BE-33). Runbook: docs/ops/db-backup.md
//
//   npm run db:backup -- [--dir <path>] [--keep <n>] [--max-age-days <d>] [--container <name>]
//
// pg_dump -Fc runs INSIDE the db container, authenticating with the container's own POSTGRES_*
// environment, so no password reaches this process, a command line or the output. The dump is streamed
// to a file OUTSIDE the repo. Prints file name, size and sha256 only; never any content.
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, openSync, readSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_BACKUP_DIR, FILE_PREFIX, FILE_SUFFIX, OpsError, applyRetention, assertOutsideRepo, captureStderr,
  ensureBackupDir, execTarget, fail, humanSize, openPartialDump, parseArgs, spawnInDb, timestamp, writeShaFile,
} from './lib/db-ops.mjs';

function intOpt(value, fallback, name) {
  if (value === undefined || value === true) return fallback;
  if (!/^\d+$/.test(String(value))) throw new OpsError(`${name} must be a non-negative integer`, 2);
  return Number(value);
}

function sha256File(path) {
  return new Promise((res, rej) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (d) => h.update(d)).on('error', rej).on('end', () => res(h.digest('hex')));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dirArg = args.dir || process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR;
  const keep = intOpt(args.keep ?? process.env.BACKUP_KEEP, 14, '--keep');
  const maxAge = intOpt(args['max-age-days'] ?? process.env.BACKUP_MAX_AGE_DAYS, 0, '--max-age-days');
  if (keep < 1) throw new OpsError('--keep must be at least 1', 2);

  const dir = assertOutsideRepo(dirArg);
  ensureBackupDir(dir);

  const target = execTarget(args);
  const name = `${FILE_PREFIX}${timestamp()}${FILE_SUFFIX}`;
  const finalPath = join(dir, name);
  const partial = `${finalPath}.partial`;

  console.log(`Backing up via ${target.label} to ${dir}`);
  // Credentials come from the container environment; nothing secret is interpolated here.
  const script =
    'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner';
  const child = spawnInDb(target, script);
  child.stdin.end();
  const stderr = captureStderr(child);
  const out = openPartialDump(partial);
  child.stdout.pipe(out);

  const code = await new Promise((res, rej) => {
    child.on('error', rej);
    child.on('close', res);
  }).catch((e) => {
    rmSync(partial, { force: true });
    throw new OpsError(`Cannot run docker: ${e.message}`);
  });
  await new Promise((res) => out.end(res));

  if (code !== 0) {
    rmSync(partial, { force: true });
    throw new OpsError(`pg_dump failed (exit ${code}). ${stderr()}`);
  }
  const size = statSync(partial).size;
  const fd = openSync(partial, 'r');
  const magic = Buffer.alloc(5);
  readSync(fd, magic, 0, 5, 0);
  closeSync(fd);
  if (size < 100 || magic.toString('latin1') !== 'PGDMP') {
    rmSync(partial, { force: true });
    throw new OpsError('Output is not a PostgreSQL custom-format dump; discarded.');
  }
  renameSync(partial, finalPath);
  const sha = await sha256File(finalPath);
  writeShaFile(finalPath, sha, name);

  const ret = applyRetention(dir, keep, maxAge);
  console.log(`OK  file:   ${finalPath}`);
  console.log(`    size:   ${humanSize(size)} (${size} bytes)`);
  console.log(`    sha256: ${sha}`);
  console.log(`    retention: keep ${keep}${maxAge ? `, max age ${maxAge} d` : ''}; kept ${ret.kept}, removed ${ret.removed.length}`);
  for (const f of ret.removed) console.log(`    removed: ${f}`);
}

main().catch(fail);
