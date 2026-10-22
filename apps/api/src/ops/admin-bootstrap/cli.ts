/**
 * Entry of `npm run admin:bootstrap -w @pp/api -- <flags>` (AZ-36). Host only: run it from a shell on the server,
 * inside the migrate image (`docker compose ... run --rm --no-deps migrate npm run admin:bootstrap -w @pp/api -- ...`).
 * The Nest app never imports it, so there is no HTTP route to it. See `admin-bootstrap.ts` for the rules.
 *
 * Exit codes: 0 done, 1 failed (database error; nothing committed), 2 usage or confirmation missing, 3 refused by
 * the database state (nothing written).
 */
import { realpathSync } from 'node:fs'
import { userInfo } from 'node:os'
import { fileURLToPath } from 'node:url'

import { createPrismaClient } from '../../db/client'
import {
  EXIT,
  parseBootstrapArgs,
  passwordFromStdin,
  passwordProblem,
  RefusedError,
  runAdminBootstrap,
  STDIN_MAX,
  USAGE,
  UsageError,
} from './admin-bootstrap'

const err = (line: string): void => {
  process.stderr.write(`${line}\n`)
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buf.length
    // Stop reading early; `passwordFromStdin` refuses anything over STDIN_MAX characters.
    if (size > STDIN_MAX * 4) throw new UsageError('Standard input is too long for a password.')
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Puts the terminal back to normal (echo on). Safe to call more than once. */
function restoreTerminal(): void {
  if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false)
}

/**
 * Reads one line from the terminal without echoing it. Ctrl-C, Ctrl-D, the end of input or a signal aborts; the
 * terminal is restored on every path (also by the process 'exit' handler in `main`). Escape sequences (arrow keys)
 * are dropped, not added to the password.
 */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin
    process.stderr.write(question)
    let value = ''
    let escape = false
    const done = (fn: () => void): void => {
      restoreTerminal()
      input.pause()
      input.off('data', onData)
      input.off('end', onEnd)
      process.off('SIGTERM', onSignal)
      process.off('SIGHUP', onSignal)
      process.stderr.write('\n')
      fn()
    }
    const onEnd = (): void => done(() => reject(new UsageError('Aborted.')))
    const onSignal = (): void => done(() => reject(new UsageError('Aborted.')))
    const onData = (buf: Buffer): void => {
      try {
        for (const ch of buf.toString('utf8')) {
          if (escape) {
            // CSI / SS3 sequences end with a letter or "~".
            if (/[A-Za-z~]/.test(ch)) escape = false
            continue
          }
          if (ch === '\u001b') {
            escape = true
            continue
          }
          if (ch === '\r' || ch === '\n') return done(() => resolve(value))
          if (ch === '\u0003' || ch === '\u0004') return done(() => reject(new UsageError('Aborted.')))
          if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
          else if (ch >= ' ') value += ch
        }
      } catch (e) {
        done(() => reject(e instanceof Error ? e : new Error(String(e))))
      }
    }
    input.setRawMode(true)
    input.resume()
    input.on('data', onData)
    input.on('end', onEnd)
    process.on('SIGTERM', onSignal)
    process.on('SIGHUP', onSignal)
  })
}

async function readPassword(passwordStdin: boolean, email: string): Promise<string> {
  if (passwordStdin) {
    if (process.stdin.isTTY) throw new UsageError('--password-stdin needs the password redirected from a file or a pipe, not typed.')
    return passwordFromStdin(await readStdin())
  }
  if (!process.stdin.isTTY) throw new UsageError('No terminal for the hidden prompt: use --password-stdin with a file.')
  const first = await promptHidden('New password (hidden): ')
  const problem = passwordProblem(first, email)
  if (problem !== null) throw new UsageError(problem)
  const second = await promptHidden('Repeat the new password: ')
  if (second !== first) throw new UsageError('The two passwords do not match.')
  return first
}

function hostUser(): string {
  try {
    return userInfo().username
  } catch {
    return 'unknown'
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  process.once('exit', restoreTerminal)
  let args
  try {
    args = parseBootstrapArgs(argv)
  } catch (e) {
    if (e instanceof UsageError) {
      err(e.message)
      err(USAGE)
      return EXIT.usage
    }
    throw e
  }
  if (args === null) {
    err(USAGE)
    return EXIT.ok
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    err('DATABASE_URL is not set (run inside the migrate image with the production env file).')
    return EXIT.usage
  }

  let password: string
  try {
    password = await readPassword(args.passwordStdin, args.email)
  } catch (e) {
    if (e instanceof UsageError) {
      err(e.message)
      return EXIT.usage
    }
    throw e
  }

  const prisma = createPrismaClient(url)
  try {
    const db = (await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0]?.name ?? '?'
    const out = await runAdminBootstrap(prisma, { ...args, password, now: new Date(), hostUser: hostUser() })
    err(
      `OK ${out.mode}: user id ${out.userId} on database "${db}". Sessions ended: ${String(out.sessionsRevoked)}. Open reset links spent: ${String(out.resetTokensSpent)}.` +
        `${out.reactivated ? ' Account reactivated.' : ''} The password must be changed at the next login. Audit row written.`,
    )
    return EXIT.ok
  } catch (e) {
    if (e instanceof UsageError) {
      err(e.message)
      return EXIT.usage
    }
    if (e instanceof RefusedError) {
      err(e.message)
      return EXIT.refused
    }
    // Database errors: the code only, never the server message (it can quote a row value). Nothing was committed.
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'unknown'
    err(`Failed (${code}); nothing was written.`)
    return EXIT.failed
  } finally {
    password = ''
    await prisma.$disconnect()
  }
}

/** True when this file is the process entry (compared by real path, so a symlink or a wrapper path still runs). */
function isEntry(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

// Run only as the entry script (the spec imports `main` without running it).
if (isEntry()) {
  process.exitCode = await main(process.argv.slice(2))
}
