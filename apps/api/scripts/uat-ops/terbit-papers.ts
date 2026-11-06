/**
 * U-OP-04 / 08 / 09 dry-run report for S3-T08: for each launch paper, what "Jana set" would do under its Kontrak. READ-ONLY: it only
 * sends GET requests (plus the login POST) and never creates, generates or publishes a paper. There is no `--apply`; the real Terbit is
 * done by the UAT developer or an admin in Set Builder after the user confirms (D110).
 *
 *   UAT_API_URL=... UAT_ADMIN_EMAIL=... UAT_ADMIN_PASSWORD=... npm run be:uat:terbit-papers
 *
 * Flow: `POST /api/auth/login` (`identifier` + `password`, session cookie kept) -> `GET /api/admin/blueprints` (all pages, the head of every
 * Kontrak) -> per launch paper that has a Kontrak, `GET /api/admin/papers/pool-preview?subject={app subject code}&kertas={n}`.
 * The app subject code comes from the blueprint list itself (`subject`), the SPM paper code (`1449/2`) from its `code`; nothing is guessed.
 * "Sains K1" is the Kontrak whose subject name is exactly `Sains` with kertas 1.
 *
 * Report columns: code, kertas, source (Spec | Disahkan | Draf), servingVersion, verdict (as returned), firstFailure (BM line of exam-core
 * `shortageLine`), eligibleTotal, publishedTotal, wouldCreate, reason. `wouldCreate` is yes only when verdict is `boleh` AND source is Spec or
 * Disahkan. Every launch row is an INFO line; FAIL means the tool could not read (login failed, blueprint list or a pool preview failed).
 * Output: table on stdout, `.evidence/uat-ops/terbit-papers-<ts>.txt` and `.csv` (counts and codes only, no personal data, no host).
 * Exit codes: 0 report produced, 1 a FAIL line, 2 usage or environment error (missing env var, bad URL, PASSWORD_CHANGE_REQUIRED).
 */
import { shortageLine, type StandardShortage } from '@pp/exam-core'

import { exitCodeOf, formatLine, isMain, line, parseUatArgs, scrubSecrets, UsageError, writeCsvReport, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = { name: 'terbit-papers', allowApply: false }

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

export interface LaunchItem {
  /** Label printed when there is no contract. */
  label: string
  /** SPM paper code, e.g. `3472/2` (matches the blueprint `code`). */
  code?: string
  /** Match by exact subject name + kertas instead of a code ("Sains K1"). */
  subjectName?: string
  kertas?: number
}

/** PRD30 U-OP-04 order. */
export const LAUNCH: readonly LaunchItem[] = [
  { label: '3472/2', code: '3472/2' },
  { label: '1449/1', code: '1449/1' },
  { label: '1249/1', code: '1249/1' },
  { label: '4531/1', code: '4531/1' },
  { label: 'Sains K1', subjectName: 'Sains', kertas: 1 },
  { label: '1449/2', code: '1449/2' },
  { label: '3472/1', code: '3472/1' },
  { label: '4531/2', code: '4531/2' },
  { label: '1249/2', code: '1249/2' },
]

/** The fields of `BijakBlueprintView` this script reads. */
export interface BlueprintHead {
  subject: string
  subjectName: string
  kertas: number
  source: 'Spec' | 'Disahkan' | 'Draf'
  code: string
  servingVersion?: number
}

/** The fields of `BijakPoolPreview` this script reads. */
export interface PoolPreviewLite {
  verdict: 'boleh' | 'tidak_boleh' | 'tidak_pasti'
  firstFailure: StandardShortage | null
  eligibleTotal: number
  publishedTotal: number
}

export interface ReportRow {
  code: string
  kertas: string
  source: string
  servingVersion: string
  verdict: string
  firstFailure: string
  eligibleTotal: string
  publishedTotal: string
  wouldCreate: 'yes' | 'no'
  reason: string
}

export const COLUMNS = ['code', 'kertas', 'source', 'servingVersion', 'verdict', 'firstFailure', 'eligibleTotal', 'publishedTotal', 'wouldCreate', 'reason'] as const

/** An error envelope (or transport failure) from a GET, as one printable text. */
export class ApiProblem extends Error {
  override readonly name = 'ApiProblem'
  constructor(
    readonly status: number,
    readonly apiCode: string,
    message: string,
  ) {
    super(message)
  }
}

export function findContract(item: LaunchItem, heads: readonly BlueprintHead[]): BlueprintHead | undefined {
  if (item.code !== undefined) return heads.find((h) => h.code === item.code)
  return heads.find((h) => h.subjectName === item.subjectName && h.kertas === item.kertas)
}

export function wouldCreateOf(source: string, verdict: string): { wouldCreate: 'yes' | 'no'; reason: string } {
  if (verdict === 'boleh' && (source === 'Spec' || source === 'Disahkan')) return { wouldCreate: 'yes', reason: '' }
  const reasons: string[] = []
  if (verdict !== 'boleh') reasons.push(`verdict ${verdict}`)
  if (source !== 'Spec' && source !== 'Disahkan') reasons.push(`source ${source}`)
  return { wouldCreate: 'no', reason: reasons.join(', ') }
}

export function noContractRow(item: LaunchItem): ReportRow {
  return {
    code: item.label,
    kertas: item.kertas === undefined ? (item.code?.split('/')[1] ?? '') : String(item.kertas),
    source: '',
    servingVersion: '',
    verdict: '',
    firstFailure: '',
    eligibleTotal: '',
    publishedTotal: '',
    wouldCreate: 'no',
    reason: 'no contract',
  }
}

export function rowOf(head: BlueprintHead, preview: PoolPreviewLite): ReportRow {
  const { wouldCreate, reason } = wouldCreateOf(head.source, preview.verdict)
  return {
    code: head.code,
    kertas: String(head.kertas),
    source: head.source,
    servingVersion: head.servingVersion === undefined ? '' : String(head.servingVersion),
    verdict: preview.verdict,
    firstFailure: preview.firstFailure ? shortageLine(preview.firstFailure) : '',
    eligibleTotal: String(preview.eligibleTotal),
    publishedTotal: String(preview.publishedTotal),
    wouldCreate,
    reason,
  }
}

/** A row for a Kontrak whose pool preview could not be read (a FAIL line is added by the caller). */
export function unreadableRow(head: BlueprintHead, problem: string): ReportRow {
  return { ...noContractRow({ label: head.code }), code: head.code, kertas: String(head.kertas), source: head.source, reason: `cannot read: ${problem}` }
}

export function rowLine(r: ReportRow): CheckLine {
  const text =
    `${r.code} K${r.kertas} source=${r.source || '-'} serving=${r.servingVersion || '-'} verdict=${r.verdict || '-'} ` +
    `eligible=${r.eligibleTotal || '-'} published=${r.publishedTotal || '-'} wouldCreate=${r.wouldCreate}` +
    (r.reason ? ` (${r.reason})` : '') +
    (r.firstFailure ? ` firstFailure: ${r.firstFailure}` : '')
  return line(r.reason.startsWith('cannot read') ? 'FAIL' : 'INFO', text)
}

/** Fixed-width stdout table (no personal data). */
export function formatTable(rows: readonly ReportRow[]): string[] {
  const cols = COLUMNS.filter((c) => c !== 'firstFailure' && c !== 'reason')
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => r[c].length)))
  const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ').trimEnd()
  const out = [fmt([...cols]), fmt(widths.map((w) => '-'.repeat(w)))]
  for (const r of rows) out.push(fmt(cols.map((c) => r[c])))
  return out
}

export function csvRows(rows: readonly ReportRow[]): string[][] {
  return rows.map((r) => COLUMNS.map((c) => r[c]))
}

export interface Credentials {
  baseUrl: string
  email: string
  password: string
}

/** Reads the three env values; a missing or bad one is a usage error (names only, never the values). */
export function credentialsFrom(env: NodeJS.ProcessEnv): Credentials {
  const missing = ['UAT_API_URL', 'UAT_ADMIN_EMAIL', 'UAT_ADMIN_PASSWORD'].filter((n) => !env[n])
  if (missing.length > 0) throw new UsageError(`${missing.join(', ')} not set.`)
  const raw = env.UAT_API_URL as string
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UsageError('UAT_API_URL is not a valid URL.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new UsageError('UAT_API_URL must be an http(s) URL.')
  return { baseUrl: raw.replace(/\/+$/, ''), email: env.UAT_ADMIN_EMAIL as string, password: env.UAT_ADMIN_PASSWORD as string }
}

function cookiesOf(res: Response): string {
  const h = res.headers as Headers & { getSetCookie?: () => string[] }
  const all = typeof h.getSetCookie === 'function' ? h.getSetCookie() : (h.get('set-cookie') ?? '').split(/,(?=\s*[^;,\s]+=)/)
  return all
    .map((c) => c.split(';')[0]?.trim() ?? '')
    .filter((c) => c.includes('='))
    .join('; ')
}

async function problemOf(res: Response): Promise<ApiProblem> {
  let code = `HTTP_${res.status}`
  let message = ''
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } }
    if (body.error?.code) code = body.error.code
    message = body.error?.message ?? ''
  } catch {
    // not JSON: keep the status code
  }
  return new ApiProblem(res.status, code, message)
}

const TIMEOUT_MS = 30_000

export class UatClient {
  private cookie = ''
  constructor(
    private readonly creds: Credentials,
    private readonly fetchFn: FetchFn,
  ) {}

  /** Real login route; stops (UsageError) on PASSWORD_CHANGE_REQUIRED. */
  async login(): Promise<void> {
    const res = await this.fetchFn(`${this.creds.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ identifier: this.creds.email, password: this.creds.password }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      const p = await problemOf(res)
      if (p.apiCode === 'PASSWORD_CHANGE_REQUIRED') throw new UsageError(PASSWORD_CHANGE_LINE)
      throw p
    }
    const body = (await res.json().catch(() => ({}))) as { data?: { mustChangePassword?: boolean } }
    if (body.data?.mustChangePassword) throw new UsageError(PASSWORD_CHANGE_LINE)
    this.cookie = cookiesOf(res)
    if (!this.cookie) throw new ApiProblem(res.status, 'NO_SESSION_COOKIE', 'login answered without a session cookie')
  }

  /** GET (no CSRF needed); returns `body.data`/the body, or throws ApiProblem (PASSWORD_CHANGE_REQUIRED stops the run). */
  async get<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.creds.baseUrl}${path}`, {
      method: 'GET',
      headers: { accept: 'application/json', cookie: this.cookie },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      const p = await problemOf(res)
      if (p.apiCode === 'PASSWORD_CHANGE_REQUIRED') throw new UsageError(PASSWORD_CHANGE_LINE)
      throw p
    }
    return (await res.json()) as T
  }
}

export const PASSWORD_CHANGE_LINE = 'PASSWORD_CHANGE_REQUIRED: the admin account must change its password first; do it in the app, then run again.'

/** Every blueprint head, all pages (page size 100). */
export async function listBlueprints(client: UatClient): Promise<BlueprintHead[]> {
  const heads: BlueprintHead[] = []
  for (let page = 1; page <= 100; page++) {
    const body = await client.get<{ data: BlueprintHead[]; meta: { totalPages: number } }>(`/api/admin/blueprints?page=${page}&pageSize=100`)
    heads.push(...body.data)
    if (page >= body.meta.totalPages) break
  }
  return heads
}

export interface RunResult {
  rows: ReportRow[]
  lines: CheckLine[]
}

/** The whole dry run against `fetchFn`. Throws UsageError for environment problems (exit 2). */
export async function runTerbitPapers(creds: Credentials, fetchFn: FetchFn, launch: readonly LaunchItem[] = LAUNCH): Promise<RunResult> {
  const client = new UatClient(creds, fetchFn)
  const scrub = (t: string) => scrubSecrets(t).split(creds.password).join('[redacted]').split(creds.baseUrl).join('[redacted]')
  const fail = (t: string): RunResult => ({ rows: [], lines: [line('FAIL', scrub(t))] })
  try {
    await client.login()
  } catch (e) {
    if (e instanceof UsageError) throw e
    return fail(`login failed: ${e instanceof ApiProblem ? `${e.apiCode} ${e.message}`.trim() : e instanceof Error ? e.message : String(e)}`)
  }
  let heads: BlueprintHead[]
  try {
    heads = await listBlueprints(client)
  } catch (e) {
    if (e instanceof UsageError) throw e
    return fail(`cannot read the blueprint list: ${e instanceof ApiProblem ? `${e.apiCode} ${e.message}`.trim() : e instanceof Error ? e.message : String(e)}`)
  }
  const rows: ReportRow[] = []
  for (const item of launch) {
    const head = findContract(item, heads)
    if (!head) {
      rows.push(noContractRow(item))
      continue
    }
    try {
      const body = await client.get<{ data: PoolPreviewLite }>(
        `/api/admin/papers/pool-preview?subject=${encodeURIComponent(head.subject)}&kertas=${head.kertas}`,
      )
      rows.push(rowOf(head, body.data))
    } catch (e) {
      if (e instanceof UsageError) throw e
      const why = e instanceof ApiProblem ? `${e.apiCode}${e.message ? ` ${e.message}` : ''}` : e instanceof Error ? e.message : String(e)
      rows.push(unreadableRow(head, scrub(why)))
    }
  }
  const lines = rows.map(rowLine).map((l) => ({ ...l, text: scrub(l.text) }))
  return { rows, lines }
}

async function main(): Promise<number> {
  const started = new Date()
  try {
    parseUatArgs(process.argv.slice(2), SPEC)
    const { rows, lines } = await runTerbitPapers(credentialsFrom(process.env), (u, i) => fetch(u, i))
    if (rows.length > 0) for (const t of formatTable(rows)) console.log(t)
    for (const l of lines) console.log(formatLine(l))
    const opts = { now: started }
    console.log(`INFO report written: ${writeReport('terbit-papers', lines, opts)}`)
    if (rows.length > 0) console.log(`INFO report written: ${writeCsvReport('terbit-papers', COLUMNS, csvRows(rows), opts)}`)
    return exitCodeOf(lines)
  } catch (e) {
    console.error(scrubSecrets(e instanceof Error ? e.message : String(e)))
    return 2
  }
}

if (isMain(import.meta.url)) {
  void main().then((code) => process.exit(code))
}
