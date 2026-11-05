/**
 * U-OP-16 support contact check for S4-T08 (PRD30 U-OP-16, N-07): after the admin sets the contact in `Tetapan`, `GET /api/config/support`
 * must answer 200 with a non-empty e-mail and WhatsApp number. READ-ONLY: one public GET, no database, no `--apply`.
 *
 *   npx tsx apps/api/scripts/uat-ops/u-op-16-support-contact.ts --api-url https://host
 *
 * FAIL when the route answers anything but 200 (404 = the singleton row is not set yet), the body is not `{ data: { email, whatsappNumber } }`,
 * or either value is empty. The report says whether each value is present, never the values themselves.
 * Exit code 0 ok, 1 a check FAILed, 2 usage error (no `--api-url`).
 */
import { exitCodeOf, formatLine, isMain, line, parseUatArgs, UsageError, writeReport, type CheckLine, type UatArgsSpec } from './lib'

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
    if (typeof raw !== 'string') throw new UsageError('--api-url <https://host> is required')
    const base = normalizeApiUrl(raw)
    let lines: CheckLine[]
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
