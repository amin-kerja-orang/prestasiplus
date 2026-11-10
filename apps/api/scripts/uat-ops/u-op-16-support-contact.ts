/**
 * U-OP-16 support contact check for S4-T08 (PRD30 U-OP-16, N-07): after the admin sets the contact in `Tetapan`, `GET /api/config/support`
 * must answer 200 with a non-empty e-mail and WhatsApp number. READ-ONLY, no `--apply`.
 *
 *   npx tsx apps/api/scripts/uat-ops/u-op-16-support-contact.ts --api-url https://host     (one public GET)
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/u-op-16-support-contact.ts           (no --api-url: reads `support_config`; used by rebuild-db.sh)
 *
 * FAIL when the route answers anything but 200 (404 = the singleton row is not set yet), the body is not `{ data: { email, whatsappNumber } }`,
 * or either value is empty. The report says whether each value is present, never the values themselves.
 * Exit code 0 ok, 1 a check FAILed (an empty setting is a PO input, not a loader fault), 2 usage or environment error.
 */
import { exitCodeOf, formatLine, isMain, line, openDb, parseUatArgs, UsageError, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = { name: 'u-op-16-support-contact', allowApply: false, flags: { 'api-url': { type: 'string' } } }

export const SUPPORT_PATH = '/api/config/support'

/** Pure: HTTP status and parsed body -> report lines. */
export function supportLines(status: number, body: unknown): CheckLine[] {
  if (status !== 200) return [line('FAIL', `GET ${SUPPORT_PATH} answered ${String(status)}, expected 200${status === 404 ? ' (the support contact is not set yet: Tetapan, N-07)' : ''}`)]
  const data = (body as { data?: unknown } | null)?.data
  if (typeof data !== 'object' || data === null) return [line('PASS', `GET ${SUPPORT_PATH} answered 200`), line('FAIL', 'the response has no data object')]
  const field = (key: 'email' | 'whatsappNumber'): CheckLine => {
    const v = (data as Record<string, unknown>)[key]
    return typeof v === 'string' && v.trim() !== '' ? line('PASS', `${key} is present (value not shown)`) : line('FAIL', `${key} is missing or empty`)
  }
  return [line('PASS', `GET ${SUPPORT_PATH} answered 200`), field('email'), field('whatsappNumber')]
}

/** The singleton row of `support_config` (DM-33); the rebuild reads it from the database because the API is stopped while the checks run. */
export const SUPPORT_ROW_SQL = `SELECT email, whatsapp_number, hours FROM support_config WHERE id = 1`

export interface SupportRow {
  email: string | null
  whatsapp_number: string | null
  hours: string | null
}

/**
 * Pure: the `support_config` row (or none) -> report lines. V2 holds no such values (its only trace is a hard-coded mailto in the Panduan view
 * and no phone, WhatsApp or hours), so the ETL cannot load them: a missing row is "PENDING PO INPUT" (the admin enters them in Tetapan, "Hubungi
 * Sokongan"), reported as a FAIL so the PO sees it in the failed-check list.
 */
export function supportRowLines(row: SupportRow | undefined): CheckLine[] {
  if (!row) return [line('FAIL', 'PENDING PO INPUT: support_config has no row; V2 holds no support e-mail, WhatsApp or hours to migrate. The admin enters them in Tetapan > Hubungi Sokongan (N-07)')]
  const filled = (v: string | null): boolean => typeof v === 'string' && v.trim() !== ''
  return [
    line('PASS', 'support_config row exists (values not shown)'),
    filled(row.email) ? line('PASS', 'email is present (value not shown)') : line('FAIL', 'PENDING PO INPUT: email is empty'),
    filled(row.whatsapp_number) ? line('PASS', 'whatsappNumber is present (value not shown)') : line('FAIL', 'PENDING PO INPUT: whatsappNumber is empty'),
    line('INFO', filled(row.hours) ? 'hours is present (optional, value not shown)' : 'hours is not set (optional)'),
  ]
}

/** Trailing slashes off; must be an http(s) URL without embedded credentials. */
export function normalizeApiUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UsageError('--api-url is not a valid URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new UsageError('--api-url must be http(s)')
  if (url.username !== '' || url.password !== '') throw new UsageError('--api-url must not contain credentials')
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

async function main(): Promise<number> {
  const started = new Date()
  try {
    const args = parseUatArgs(process.argv.slice(2), SPEC)
    const raw = args.values['api-url']
    let lines: CheckLine[]
    if (typeof raw !== 'string') {
      // No --api-url: read the table (this is how the rebuild runs it, with the API stopped).
      const db = await openDb()
      try {
        lines = supportRowLines(await db.readOnly(async (c) => (await c.query<SupportRow>(SUPPORT_ROW_SQL)).rows[0]))
      } finally {
        await db.close()
      }
      for (const l of lines) console.log(formatLine(l))
      console.log(`INFO report written: ${writeReport('u-op-16-support-contact', lines, { now: started })}`)
      return exitCodeOf(lines)
    }
    const base = normalizeApiUrl(raw)
    try {
      const res = await fetch(`${base}${SUPPORT_PATH}`, { signal: AbortSignal.timeout(15_000) })
      let body: unknown = null
      try {
        body = await res.json()
      } catch {
        body = null
      }
      lines = supportLines(res.status, body)
    } catch (e) {
      lines = [line('FAIL', `GET ${SUPPORT_PATH} failed: ${e instanceof Error ? e.name : 'error'}`)]
    }
    for (const l of lines) console.log(formatLine(l))
    console.log(`INFO report written: ${writeReport('u-op-16-support-contact', lines, { now: started })}`)
    return exitCodeOf(lines)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  }
}

if (isMain(import.meta.url)) void main().then((code) => process.exit(code))
