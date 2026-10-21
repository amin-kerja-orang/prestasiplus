/**
 * The MySQL option file (AM-10). All connection details (host, port, user, password, database, ssl-mode) live in ONE
 * file named by `CLOUD_MYSQL_DEFAULTS_FILE`; the spawned client gets `--defaults-file=<file>`, so nothing secret is
 * ever on a command line, in the environment of the child, or in shell history.
 *
 * The file must exist, be a regular file, sit OUTSIDE the repository and the working directory (real paths), and on
 * POSIX not be readable by group or others (chmod 600). `!include` directives are refused (they could pull in a second,
 * unchecked file). The values of user, password and host are collected as secrets so every client message is scrubbed.
 *
 * TLS: a host that is not local (anything but localhost, 127.0.0.1, ::1, or no host at all = a socket) is refused unless
 * the file demands certificate verification: `ssl-mode=VERIFY_IDENTITY` or `VERIFY_CA` (MySQL client), or, when no
 * ssl-mode is set, `ssl-verify-server-cert` with ssl on (MariaDB client). REQUIRED, PREFERRED, DISABLED, `ssl=0` or no
 * setting on a remote host are refused. A local host (an SSH tunnel to 127.0.0.1) needs no TLS.
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DumpUsageError } from './errors'

export const WINDOWS_WARNING =
  'File permissions are not enforced on Windows; keep the option file, the key and the output in your user profile on an encrypted disk.'

type Env = Readonly<Record<string, string | undefined>>

export const repoRoot = (): string => fileURLToPath(new URL('../../../../../', import.meta.url))

export const real = (p: string): string => {
  try {
    return realpathSync.native(p)
  } catch {
    return resolve(p)
  }
}

export const isInside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export interface OptionFile {
  /** Absolute path (not real path) of the file, for `--defaults-file`. */
  path: string
  /** Strings to scrub from every message: password (any length), user and host (3+ characters). */
  secrets: string[]
  warnings: string[]
}

function unquote(value: string): string {
  const v = value.trim()
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) return v.slice(1, -1)
  return v
}

/** Reads `key=value` pairs of the `[client]` and `[mysql]` groups. Pure; exported for tests. */
export function parseOptionText(text: string): { values: Map<string, string>; raw: Map<string, string>; hasInclude: boolean; groups: string[]; outsideGroup: boolean } {
  const values = new Map<string, string>()
  const raw = new Map<string, string>()
  let hasInclude = false
  let outsideGroup = false
  const groups = new Set<string>()
  let group = ''
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue
    if (line.startsWith('!include')) {
      hasInclude = true
      continue
    }
    const g = /^\[([^\]]*)\]$/.exec(line)
    if (g) {
      group = (g[1] as string).trim().toLowerCase()
      groups.add(group)
      continue
    }
    if (group === '') outsideGroup = true
    if (group !== 'client' && group !== 'mysql') continue
    const eq = line.indexOf('=')
    const key = (eq === -1 ? line : line.slice(0, eq)).trim().toLowerCase().replace(/_/g, '-')
    if (eq === -1) {
      values.set(key, '') // a bare flag such as `ssl-verify-server-cert`
      raw.set(key, '')
      continue
    }
    raw.set(key, unquote(line.slice(eq + 1)))
    values.set(key, unquote(line.slice(eq + 1).replace(/\s+#.*$/, '')))
  }
  return { values, raw, hasInclude, groups: [...groups], outsideGroup }
}

const OFF = new Set(['0', 'false', 'off', 'no'])
/** A bare flag (empty value) or an explicit on value. */
const flagOn = (v: string | undefined): boolean => v !== undefined && !OFF.has(v.toLowerCase())

export function isLocalHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '')
  return h === '' || h === 'localhost' || h === '127.0.0.1' || h === '::1'
}

const TLS_REFUSED =
  'The option file points to a remote host without verified TLS: use VERIFY_IDENTITY or an SSH tunnel to 127.0.0.1 (ssl-mode=VERIFY_IDENTITY or VERIFY_CA under [client]; MariaDB client: ssl plus ssl-verify-server-cert).'

/** Exported for tests: the TLS rule on parsed option values. */
export function assertTransportSafe(values: ReadonlyMap<string, string>): void {
  if (isLocalHost(values.get('host') ?? '')) return
  const mode = values.get('ssl-mode')
  if (mode !== undefined) {
    if (/^VERIFY_(IDENTITY|CA)$/i.test(mode.trim())) return
    throw new DumpUsageError(TLS_REFUSED)
  }
  // MariaDB client style: ssl on AND the server certificate verified.
  if (!values.has('skip-ssl') && !values.has('disable-ssl') && flagOn(values.get('ssl')) && flagOn(values.get('ssl-verify-server-cert'))) return
  throw new DumpUsageError(TLS_REFUSED)
}

export function loadOptionFile(env: Env, platform: string, roots: readonly string[] = [repoRoot(), process.cwd()]): OptionFile {
  const file = env.CLOUD_MYSQL_DEFAULTS_FILE
  if (file === undefined || file === '') {
    throw new DumpUsageError(
      'CLOUD_MYSQL_DEFAULTS_FILE is not set. Point it to a MySQL option file ([client] host, port, user, password, database, ssl-mode) outside the repository. Connection details are never accepted as flags.',
    )
  }
  const path = resolve(file)
  if (!existsSync(path) || !statSync(path).isFile()) throw new DumpUsageError('CLOUD_MYSQL_DEFAULTS_FILE does not name a readable file.')
  const where = real(path)
  if (roots.some((r) => isInside(where, real(r)))) {
    throw new DumpUsageError('CLOUD_MYSQL_DEFAULTS_FILE is inside the repository or the working directory. Keep the option file outside it.')
  }
  const warnings: string[] = []
  if (platform === 'win32') warnings.push(WINDOWS_WARNING)
  else if ((statSync(path).mode & 0o077) !== 0) {
    throw new DumpUsageError('CLOUD_MYSQL_DEFAULTS_FILE must not be readable by group or others (chmod 600).')
  }
  const { values, raw, hasInclude, groups, outsideGroup } = parseOptionText(readFileSync(path, 'utf8'))
  if (hasInclude) throw new DumpUsageError('The option file uses !include or !includedir; put all settings in the one file.')
  if (outsideGroup) throw new DumpUsageError('The option file has settings outside any [group]; put them under [client].')
  for (const g of groups) {
    // Only [client] (and [mysql]) are read. Other groups ([client-server], [client-mariadb], [mariadb], [mysqldump], ...) are refused:
    // they are not what the export uses and could carry settings the client would pick up. The message names the group only.
    if (g !== 'client' && g !== 'mysql') {
      const shown = /^[a-z0-9_.-]{1,40}$/.test(g) ? g : '(unprintable name)'
      throw new DumpUsageError(`The option file has a [${shown}] group. Only [client] is accepted; remove the other groups.`)
    }
  }

  const secrets: string[] = []
  // Both readings of the value (with and without an inline comment): whichever the client used gets scrubbed.
  for (const v of [values.get('password'), raw.get('password')]) if (v) secrets.push(v)
  for (const key of ['user', 'host'] as const) {
    for (const v of [values.get(key), raw.get(key)]) if (v && v.length >= 3) secrets.push(v)
  }
  assertTransportSafe(values)
  return { path, secrets, warnings }
}
