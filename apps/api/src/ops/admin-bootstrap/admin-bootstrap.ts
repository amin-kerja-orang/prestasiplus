/**
 * AZ-36: audited Admin Pusat bootstrap / reset for the host (runbook F1 fallback and "Locked-out last Admin Pusat").
 *
 * This file holds the parts that can be tested without a terminal: argument parsing, the password rules and the
 * database work. `cli.ts` is the only entry; nothing in the Nest app imports this folder, so no HTTP route can
 * reach it (a spec pins that).
 *
 * Rules:
 * - `--confirm=<e-mail>` must repeat `--email` exactly, or nothing runs (exit 2).
 * - A password is never an argument: any `--password...` flag, and any positional argument, is refused before
 *   anything else happens (the value is never echoed). It comes from a hidden TTY prompt or `--password-stdin`.
 * - `create` only when NO active, unsuspended Admin Pusat exists; `reset` only when the target is the LAST one
 *   (otherwise another admin resets it on the admin screen, runbook section 21).
 * - Both store an argon2id hash, give the account the national `admin` scope, end every live session of the account,
 *   spend its open password-reset tokens and write one `audit_events` row, all in one transaction under the same
 *   advisory lock as the users module's last-admin guard.
 * - R39b (LEAD decision R39 item 1): neither mode forces a password change. `create` stores `must_reset_password = false`
 *   and `reset` CLEARS an existing flag (the CLI reset is a recovery path; the operator typed the password at the hidden prompt).
 */
import { hash } from '@node-rs/argon2'

import type { PrismaClient, TxClient } from '../../db/client'
import { ARGON2_OPTIONS } from '../../modules/auth/argon2-params'

export const BOOTSTRAP_AUDIT = { CREATED: 'admin.bootstrap.created', RESET: 'admin.bootstrap.reset' } as const
/** `audit_events.actor_role` of a host run (there is no actor user). */
export const HOST_ACTOR_ROLE = 'host_cli'

export const EXIT = { ok: 0, failed: 1, usage: 2, refused: 3 } as const

/** Same floor as an admin-typed initial password (`INITIAL_PASSWORD_MIN_LENGTH`); the operator types it at the hidden prompt. */
export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 255
export const DEFAULT_NAME = 'Admin Pusat'
/** Standard input larger than this is not a password file (characters). */
export const STDIN_MAX = 1024

export type BootstrapMode = 'create' | 'reset'

export interface BootstrapArgs {
  mode: BootstrapMode
  email: string
  name: string
  passwordStdin: boolean
  /** `reset` only: also clear `is_active = false` / `is_suspended = true` on the target. */
  reactivate: boolean
}

/** Usage problem (exit 2). The message never contains an argument value. */
export class UsageError extends Error {}
/** The database state does not allow the run (exit 3). Nothing was written. */
export class RefusedError extends Error {}

export const USAGE = `Usage (run on the host, inside the migrate image):
  npm run admin:bootstrap -w @pp/api -- --mode=create|reset --email=<e-mail> --confirm=<same e-mail>
      [--name="<display name>"] (create only) [--reactivate] (reset only) [--password-stdin]

  The new password is read from a hidden prompt (typed twice), or with --password-stdin from standard input
  (for example "< /root/pp-admin-pass", a mode 600 file you delete right after). Never pass it as an argument.
  No password change is required at the next login.`

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Flag names that look like a secret (`--password`, `--pass`, `--pwd`, `--pw`, `--secret`, `--new-password`, ...). */
const SECRET_FLAG = /pass|pwd|^pw$|secret|kata/
const KNOWN = new Set(['mode', 'email', 'confirm', 'name', 'password-stdin', 'reactivate', 'help'])

/** Parses `argv` (without node and the script). Throws `UsageError`; returns null for `--help`. */
export function parseBootstrapArgs(argv: readonly string[]): BootstrapArgs | null {
  // Secret guard first, before any other check can print anything about the arguments.
  for (const token of argv) {
    const key = token.replace(/^-+/, '').split('=')[0]?.toLowerCase() ?? ''
    if (token.startsWith('-') && key !== 'password-stdin' && (SECRET_FLAG.test(key) || key === 'p')) {
      throw new UsageError('A password is never accepted as an argument. Use the prompt or --password-stdin.')
    }
  }
  const flags = new Map<string, string | true>()
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string
    if (!token.startsWith('--')) throw new UsageError('Positional arguments are not accepted (a password is never an argument).')
    const eq = token.indexOf('=')
    const key = (eq === -1 ? token.slice(2) : token.slice(2, eq)).toLowerCase()
    // The flag name is not echoed either (a secret typed as a flag name must not reach the terminal log).
    if (!KNOWN.has(key)) throw new UsageError('Unknown flag (see the usage below).')
    if (flags.has(key)) throw new UsageError(`--${key} is given twice.`)
    let value: string | true = true
    if (eq !== -1) value = token.slice(eq + 1)
    else if (['mode', 'email', 'confirm', 'name'].includes(key)) {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) throw new UsageError(`--${key} needs a value.`)
      value = next
      i++
    }
    flags.set(key, value)
  }
  if (flags.has('help')) return null

  const text = (key: string): string => {
    const v = flags.get(key)
    if (v === undefined) throw new UsageError(`--${key} is required.`)
    if (v === true) throw new UsageError(`--${key} needs a value.`)
    return v
  }
  const bool = (key: string): boolean => {
    const v = flags.get(key)
    if (v === undefined) return false
    if (v !== true) throw new UsageError(`--${key} takes no value.`)
    return true
  }

  const mode = text('mode')
  if (mode !== 'create' && mode !== 'reset') throw new UsageError('--mode must be create or reset.')
  // Lower case, as the app stores e-mails (lookups and the unique index use lower(email)).
  const email = text('email').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 255) throw new UsageError('--email is not a valid e-mail address.')
  if (!flags.has('confirm')) throw new UsageError('Refused: --confirm=<the same e-mail> is required (explicit confirmation).')
  if (text('confirm').trim().toLowerCase() !== email) throw new UsageError('Refused: --confirm must repeat --email exactly.')
  const reactivate = bool('reactivate')
  if (reactivate && mode !== 'reset') throw new UsageError('--reactivate is only for --mode=reset.')
  if (flags.has('name') && mode !== 'create') throw new UsageError('--name is only for --mode=create.')
  const name = flags.has('name') ? text('name').trim() : DEFAULT_NAME
  if (name.length === 0 || name.length > 255) throw new UsageError('--name must be 1 to 255 characters.')
  return { mode, email, name, passwordStdin: bool('password-stdin'), reactivate }
}

/** Password rules of a bootstrap run. Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN) return `The password must have at least ${String(PASSWORD_MIN)} characters.`
  if (password.length > PASSWORD_MAX) return `The password must have at most ${String(PASSWORD_MAX)} characters.`
  if (/[\r\n]/.test(password)) return 'The password must be one line.'
  if (password.trim() !== password) return 'The password must not start or end with a space.'
  const local = email.toLowerCase().split('@')[0] ?? ''
  if (local.length >= 4 && password.toLowerCase().includes(local)) return 'The password must not contain the e-mail name.'
  return null
}

/**
 * Standard input as the password: the whole input, one trailing line break removed. More than one line is refused
 * (a file holding several secrets, or a paste with an extra line).
 */
export function passwordFromStdin(raw: string): string {
  if (raw.length > STDIN_MAX) throw new UsageError('Standard input is too long for a password.')
  const value = raw.replace(/^\uFEFF/, '').replace(/\r?\n$/, '')
  if (/[\r\n]/.test(value)) throw new UsageError('Standard input must hold the password on one line only.')
  return value
}

export interface BootstrapInput extends BootstrapArgs {
  password: string
  now: Date
  /** OS account that ran the command (stored in the audit detail; not a secret). */
  hostUser: string
}

export interface BootstrapResult {
  mode: BootstrapMode
  userId: string
  sessionsRevoked: number
  resetTokensSpent: number
  reactivated: boolean
}

/** Hash outside the transaction (argon2id is slow; the advisory lock must not wait on it). */
export const hashPassword = (plain: string): Promise<string> => hash(plain, ARGON2_OPTIONS)

/** Active, unsuspended admins (the same definition as the users module's last-admin guard). */
async function activeAdminIds(tx: TxClient): Promise<bigint[]> {
  const rows = await tx.user.findMany({ where: { isActive: true, isSuspended: false, roles: { some: { role: 'admin' } } }, select: { id: true } })
  return rows.map((r) => r.id)
}

export async function runAdminBootstrap(prisma: PrismaClient, input: BootstrapInput): Promise<BootstrapResult> {
  const problem = passwordProblem(input.password, input.email)
  if (problem !== null) throw new UsageError(problem)
  const passwordHash = await hashPassword(input.password)

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('users.admin-changes'))`
      const admins = await activeAdminIds(tx)
      const found = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM users WHERE lower(email) = lower(${input.email}) LIMIT 1`
      const existing = found[0]
        ? await tx.user.findUnique({ where: { id: found[0].id }, select: { id: true, isActive: true, isSuspended: true, roles: { select: { role: true } } } })
        : null

      let userId: bigint
      let reactivated = false
      if (input.mode === 'create') {
        if (admins.length > 0) throw new RefusedError('Refused: an active Admin Pusat already exists. Use the admin user screen, or --mode=reset for a locked-out last admin.')
        if (existing) throw new RefusedError('Refused: an account with this e-mail already exists. Use --mode=reset if it is the locked-out last Admin Pusat.')
        const row = await tx.user.create({
          data: { name: input.name, email: input.email, passwordHash, mustResetPassword: false, isActive: true, isSuspended: false, createdAt: input.now, updatedAt: input.now },
          select: { id: true },
        })
        userId = row.id
        await tx.userRole.create({ data: { userId, role: 'admin', createdAt: input.now } })
      } else {
        if (!existing || !existing.roles.some((r) => r.role === 'admin')) throw new RefusedError('Refused: no Admin Pusat account has this e-mail.')
        if (admins.some((id) => id !== existing.id)) {
          throw new RefusedError('Refused: another active Admin Pusat exists. That admin resets this account on the admin user screen (runbook section 21).')
        }
        const blocked = !existing.isActive || existing.isSuspended
        if (blocked && !input.reactivate) throw new RefusedError('Refused: this account is inactive or suspended. Add --reactivate if it must sign in again.')
        reactivated = blocked
        userId = existing.id
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash, mustResetPassword: false, updatedAt: input.now, ...(blocked ? { isActive: true, isSuspended: false } : {}) },
        })
      }
      await tx.userScope.upsert({
        where: { userId_role: { userId, role: 'admin' } },
        create: { userId, role: 'admin', level: 'national', createdAt: input.now, updatedAt: input.now },
        update: { level: 'national', stateCode: null, districtCode: null, schoolId: null, updatedAt: input.now },
      })
      const revoked = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: input.now } })
      // Open e-mail / IC reset tokens are spent too: after a takeover, an earlier token must not undo the recovery.
      const tokens = await tx.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: input.now } })
      await tx.auditEvent.create({
        data: {
          actorUserId: null,
          actorRole: HOST_ACTOR_ROLE,
          scopeLevel: 'national',
          action: input.mode === 'create' ? BOOTSTRAP_AUDIT.CREATED : BOOTSTRAP_AUDIT.RESET,
          targetType: 'user',
          targetId: userId.toString(),
          // Small facts only: never the e-mail, the password or its hash.
          detail: { mode: input.mode, hostUser: input.hostUser.slice(0, 64), mustChangePassword: false, sessionsRevoked: revoked.count, resetTokensSpent: tokens.count, reactivated, activeAdminsBefore: admins.length },
          createdAt: input.now,
        },
      })
      return { mode: input.mode, userId: userId.toString(), sessionsRevoked: revoked.count, resetTokensSpent: tokens.count, reactivated }
    },
    { timeout: 30_000, maxWait: 30_000 },
  )
}
