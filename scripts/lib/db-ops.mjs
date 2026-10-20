// Shared helpers for scripts/db-backup.mjs and scripts/db-restore-check.mjs (BE-33).
// No secrets pass through here: the database user, password and name are read INSIDE the db
// container from its own environment (POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_BACKUP_DIR = join(homedir(), 'pp-backups');
export const FILE_PREFIX = 'pp-backup-';
export const FILE_SUFFIX = '.dump';
export const RESTORE_SUFFIX = '_restorecheck';

export class OpsError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.exitCode = code;
  }
}

/** Parse `--key value`, `--key=value` and bare `--flag`. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new OpsError(`Unexpected argument: ${a}`, 2);
    const eq = a.indexOf('=');
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

/** Realpath of the nearest existing ancestor + the not-yet-existing tail. */
function realResolve(p) {
  let cur = resolve(p);
  const tail = [];
  while (!existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) break;
    tail.unshift(parse(cur).base);
    cur = parent;
  }
  return join(realpathSync(cur), ...tail);
}

/** Throws if `p` is the repo root or anywhere inside it (symlinks and 8.3 names resolved). */
export function assertOutsideRepo(p) {
  const target = realResolve(p);
  const root = realpathSync(REPO_ROOT);
  const rel = relative(root, target);
  const inside = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  if (inside) {
    throw new OpsError(
      'Refusing to use a path inside the repository. Backups contain personal data of minors ' +
        'and must stay outside the repo tree. Choose another --dir / BACKUP_DIR.',
      3,
    );
  }
  return target;
}

/**
 * Where to run the Postgres client tools.
 *  --container <name> (or DB_CONTAINER): `docker exec` into that container (used for throwaway checks).
 *  default: the `db` service of the compose project (`docker compose -f compose.yaml exec -T db`).
 */
export function execTarget(args) {
  const container = args.container || process.env.DB_CONTAINER;
  if (container) {
    return { label: `container ${container}`, base: ['docker', 'exec', '-i', String(container)] };
  }
  return {
    label: 'compose service db',
    base: ['docker', 'compose', '-f', join(REPO_ROOT, 'compose.yaml'), '--project-directory', REPO_ROOT, 'exec', '-T', 'db'],
  };
}

/** Spawn `sh -c <script>` inside the db container (stdio piped). */
export function spawnInDb(target, script) {
  const [cmd, ...rest] = target.base;
  return spawn(cmd, [...rest, 'sh', '-c', script], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
}

/** Run `sh -c <script>` to completion; `input` goes to stdin. Small outputs only. */
export function runInDb(target, script, input) {
  const [cmd, ...rest] = target.base;
  const r = spawnSync(cmd, [...rest, 'sh', '-c', script], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error) throw new OpsError(`Cannot run docker: ${r.error.message}`);
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Collect (capped) stderr of a child for error messages. Never stdout: that could be dump content. */
export function captureStderr(child) {
  let buf = '';
  child.stderr?.on('data', (d) => {
    if (buf.length < 4000) buf += d.toString();
  });
  return () => buf.trim();
}

export function timestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function humanSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
  return `${(n / 1024 ** 3).toFixed(2)} GiB`;
}

export function fail(err) {
  const code = err instanceof OpsError ? err.exitCode : 1;
  console.error(`ERROR: ${err.message}`);
  process.exit(code);
}
