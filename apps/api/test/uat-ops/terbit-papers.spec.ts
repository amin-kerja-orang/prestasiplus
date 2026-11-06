import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { exitCodeOf, parseUatArgs, toCsv, UsageError, writeCsvReport, writeReport } from '../../scripts/uat-ops/lib'
import {
  COLUMNS,
  credentialsFrom,
  csvRows,
  formatTable,
  LAUNCH,
  runTerbitPapers,
  SPEC,
  wouldCreateOf,
  type BlueprintHead,
  type FetchFn,
  type PoolPreviewLite,
} from '../../scripts/uat-ops/terbit-papers'

/** S3-T08 Terbit dry-run report: report builder + the whole flow against a stub API (no network, no database). */
const BASE = 'https://stub.invalid'
const creds = { baseUrl: BASE, email: 'ops@example.invalid', password: 'stub-pass' }

const head = (code: string, subject: string, subjectName: string, source: BlueprintHead['source'], extra: Partial<BlueprintHead> = {}): BlueprintHead => ({
  code,
  subject,
  subjectName,
  kertas: Number(code.split('/')[1] ?? 1),
  source,
  ...extra,
})
const preview = (verdict: PoolPreviewLite['verdict'], extra: Partial<PoolPreviewLite> = {}): PoolPreviewLite => ({
  verdict,
  firstFailure: null,
  eligibleTotal: 120,
  publishedTotal: 150,
  ...extra,
})

const heads: BlueprintHead[] = [
  head('3472/2', 'ADDMATH', 'Matematik Tambahan', 'Disahkan', { servingVersion: 2 }),
  head('1449/1', 'FIZIK', 'Fizik', 'Spec'),
  head('1449/2', 'FIZIK', 'Fizik', 'Draf'),
  head('4531/2', 'BIO', 'Biologi', 'Spec'),
  head('SAINS-1', 'SAINS', 'Sains', 'Disahkan', { kertas: 1 }),
  head('SRT-1', 'SAINS-SRT', 'Sains Rumah Tangga', 'Disahkan', { kertas: 1 }),
]
const previews: Record<string, PoolPreviewLite> = {
  'ADDMATH:2': preview('boleh'),
  'FIZIK:1': preview('tidak_boleh', {
    firstFailure: { section: 'Bahagian A', need: 10, have: 4 },
    eligibleTotal: 4,
  }),
  'FIZIK:2': preview('boleh'),
  'BIO:2': preview('tidak_pasti'),
  'SAINS:1': preview('boleh', { eligibleTotal: 30, publishedTotal: 31 }),
}

interface Stub {
  fetch: FetchFn
  calls: { method: string; path: string; cookie?: string; body?: string }[]
}
function stub(opts: { loginStatus?: number; loginBody?: unknown; failPreview?: string; pages?: boolean } = {}): Stub {
  const calls: Stub['calls'] = []
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
  const f: FetchFn = async (input, init) => {
    const url = new URL(input)
    const method = init?.method ?? 'GET'
    const h = (init?.headers ?? {}) as Record<string, string>
    calls.push({ method, path: url.pathname + url.search, ...(h.cookie ? { cookie: h.cookie } : {}), ...(typeof init?.body === 'string' ? { body: init.body } : {}) })
    if (url.pathname === '/api/auth/login') {
      if (opts.loginStatus && opts.loginStatus !== 200) return json(opts.loginStatus, opts.loginBody ?? { error: { code: 'UNAUTHORIZED', message: 'Salah' } })
      return json(200, opts.loginBody ?? { data: { mustChangePassword: false } }, { 'set-cookie': 'pp_session=tok123; Path=/; HttpOnly' })
    }
    if (h.cookie !== 'pp_session=tok123') return json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } })
    if (url.pathname === '/api/admin/blueprints') {
      const page = Number(url.searchParams.get('page'))
      const slice = opts.pages ? heads.slice((page - 1) * 3, page * 3) : heads
      return json(200, { data: slice, meta: { page, pageSize: 100, totalItems: heads.length, totalPages: opts.pages ? 2 : 1 } })
    }
    if (url.pathname === '/api/admin/papers/pool-preview') {
      const key = `${url.searchParams.get('subject')}:${url.searchParams.get('kertas')}`
      if (opts.failPreview === key) return json(422, { error: { code: 'VALIDATION_ERROR', message: 'Gagal' } })
      const p = previews[key]
      return p ? json(200, { data: p }) : json(404, { error: { code: 'NOT_FOUND', message: 'tiada' } })
    }
    return json(404, { error: { code: 'NOT_FOUND', message: 'tiada' } })
  }
  return { fetch: f, calls }
}

const roots: string[] = []
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true })
})

describe('arguments and environment', () => {
  it('is read-only: --apply is a usage error', () => {
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('terbit-papers is read-only: there is no --apply')
    expect(parseUatArgs([], SPEC).dryRun).toBe(true)
  })

  it('names the missing env vars (never values) and rejects a bad URL', () => {
    expect(() => credentialsFrom({})).toThrow('UAT_API_URL, UAT_ADMIN_EMAIL, UAT_ADMIN_PASSWORD not set.')
    expect(() => credentialsFrom({ UAT_API_URL: 'nope', UAT_ADMIN_EMAIL: 'a', UAT_ADMIN_PASSWORD: 'b' })).toThrow('not a valid URL')
    expect(credentialsFrom({ UAT_API_URL: `${BASE}//`, UAT_ADMIN_EMAIL: 'a', UAT_ADMIN_PASSWORD: 'b' }).baseUrl).toBe(BASE)
  })
})

describe('wouldCreateOf', () => {
  it('is yes only for verdict boleh and source Spec or Disahkan', () => {
    expect(wouldCreateOf('Spec', 'boleh')).toEqual({ wouldCreate: 'yes', reason: '' })
    expect(wouldCreateOf('Disahkan', 'boleh').wouldCreate).toBe('yes')
    expect(wouldCreateOf('Disahkan', 'tidak_boleh')).toEqual({ wouldCreate: 'no', reason: 'verdict tidak_boleh' })
    expect(wouldCreateOf('Disahkan', 'tidak_pasti').reason).toBe('verdict tidak_pasti')
    expect(wouldCreateOf('Draf', 'boleh')).toEqual({ wouldCreate: 'no', reason: 'source Draf' })
    expect(wouldCreateOf('Draf', 'tidak_boleh').reason).toBe('verdict tidak_boleh, source Draf')
  })
})

describe('runTerbitPapers (stub API)', () => {
  it('reports the launch list in order, with no contract rows, shortage text and Sains matched by exact name', async () => {
    const s = stub()
    const { rows, lines } = await runTerbitPapers(creds, s.fetch)
    expect(rows.map((r) => r.code)).toEqual(['3472/2', '1449/1', '1249/1', '4531/1', 'SAINS-1', '1449/2', '3472/1', '4531/2', '1249/2'])
    const by = Object.fromEntries(rows.map((r, i) => [LAUNCH[i]!.label, r]))
    expect(by['3472/2']).toMatchObject({ source: 'Disahkan', servingVersion: '2', verdict: 'boleh', wouldCreate: 'yes', eligibleTotal: '120', publishedTotal: '150' })
    expect(by['1449/1']).toMatchObject({ source: 'Spec', verdict: 'tidak_boleh', wouldCreate: 'no', reason: 'verdict tidak_boleh', eligibleTotal: '4' })
    expect(by['1449/1']!.firstFailure).toBe('Bahagian A: perlu 10 soalan, hanya 4 tersedia')
    expect(by['1249/1']).toMatchObject({ reason: 'no contract', wouldCreate: 'no', verdict: '' })
    expect(by['4531/1']!.reason).toBe('no contract')
    expect(by['Sains K1']).toMatchObject({ source: 'Disahkan', verdict: 'boleh', wouldCreate: 'yes', eligibleTotal: '30' })
    expect(by['1449/2']).toMatchObject({ source: 'Draf', verdict: 'boleh', wouldCreate: 'no', reason: 'source Draf' })
    expect(by['4531/2']).toMatchObject({ verdict: 'tidak_pasti', wouldCreate: 'no' })
    expect(by['3472/1']!.reason).toBe('no contract')
    expect(lines.every((l) => l.status === 'INFO')).toBe(true)
    expect(exitCodeOf(lines)).toBe(0)
  })

  it('logs in with identifier + password, keeps the cookie, reads blueprints by page, and only GETs after login', async () => {
    const s = stub({ pages: true })
    const { rows } = await runTerbitPapers(creds, s.fetch)
    expect(rows).toHaveLength(LAUNCH.length)
    expect(JSON.parse(s.calls[0]!.body!)).toEqual({ identifier: creds.email, password: creds.password })
    expect(s.calls.slice(1).every((c) => c.method === 'GET' && c.cookie === 'pp_session=tok123')).toBe(true)
    expect(s.calls.filter((c) => c.method !== 'GET').map((c) => c.path)).toEqual(['/api/auth/login'])
    expect(s.calls.some((c) => /papers\/(generate|publish)/.test(c.path) || c.path === '/api/admin/papers')).toBe(false)
    expect(s.calls.filter((c) => c.path.startsWith('/api/admin/blueprints')).map((c) => c.path)).toEqual([
      '/api/admin/blueprints?page=1&pageSize=100',
      '/api/admin/blueprints?page=2&pageSize=100',
    ])
    expect(s.calls.find((c) => c.path.includes('pool-preview'))!.path).toBe('/api/admin/papers/pool-preview?subject=ADDMATH&kertas=2')
  })

  it('stops with a usage error (exit 2) on PASSWORD_CHANGE_REQUIRED, from the login error or the session flag', async () => {
    const blocked = { error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'tukar' } }
    await expect(runTerbitPapers(creds, stub({ loginStatus: 403, loginBody: blocked }).fetch)).rejects.toThrow(UsageError)
    await expect(runTerbitPapers(creds, stub({ loginBody: { data: { mustChangePassword: true } } }).fetch)).rejects.toThrow('PASSWORD_CHANGE_REQUIRED')
  })

  it('a failed login is one FAIL line (exit 1) that does not leak the password or host', async () => {
    const { rows, lines } = await runTerbitPapers(creds, stub({ loginStatus: 401, loginBody: { error: { code: 'UNAUTHORIZED', message: `bad ${creds.password} at ${BASE}` } } }).fetch)
    expect(rows).toEqual([])
    expect(lines).toHaveLength(1)
    expect(lines[0]!.status).toBe('FAIL')
    expect(lines[0]!.text).toContain('UNAUTHORIZED')
    expect(lines[0]!.text).not.toContain(creds.password)
    expect(lines[0]!.text).not.toContain(BASE)
    expect(exitCodeOf(lines)).toBe(1)
  })

  it('a pool preview that cannot be read is a FAIL row with the error code', async () => {
    const { rows, lines } = await runTerbitPapers(creds, stub({ failPreview: 'FIZIK:1' }).fetch)
    expect(rows[1]!.reason).toBe('cannot read: VALIDATION_ERROR Gagal')
    expect(lines[1]!.status).toBe('FAIL')
    expect(exitCodeOf(lines)).toBe(1)
  })
})

describe('report output', () => {
  it('prints a table and writes the .txt and .csv beside each other with the documented columns', async () => {
    const { rows, lines } = await runTerbitPapers(creds, stub().fetch)
    const table = formatTable(rows)
    expect(table[0]).toMatch(/^code\s+kertas\s+source\s+servingVersion\s+verdict\s+eligibleTotal\s+publishedTotal\s+wouldCreate$/)
    expect(table).toHaveLength(rows.length + 2)
    const root = mkdtempSync(join(tmpdir(), 'terbit-'))
    roots.push(root)
    const now = new Date('2026-11-05T10:20:30.123Z')
    const txt = writeReport('terbit-papers', lines, { root, now })
    const csv = writeCsvReport('terbit-papers', COLUMNS, csvRows(rows), { root, now })
    expect(csv).toBe(txt.replace(/\.txt$/, '.csv'))
    const csvText = readFileSync(csv, 'utf8').split('\n')
    expect(csvText[0]).toBe('code,kertas,source,servingVersion,verdict,firstFailure,eligibleTotal,publishedTotal,wouldCreate,reason')
    expect(csvText[2]).toBe('1449/1,1,Spec,,tidak_boleh,"Bahagian A: perlu 10 soalan, hanya 4 tersedia",4,150,no,verdict tidak_boleh')
    expect(readFileSync(txt, 'utf8')).not.toContain(BASE)
  })
})

describe('csv helper (lib.ts)', () => {
  it('quotes fields with commas, quotes and line breaks, and leaves empty values empty', () => {
    expect(toCsv(['a', 'b', 'c'], [['x,y', 'say "hi"', null], [1, true, undefined], ['l1\nl2', '', 'ok']])).toBe(
      'a,b,c\n"x,y","say ""hi""",\n1,true,\n"l1\nl2",,ok\n',
    )
  })

  it('writes <root>/.evidence/uat-ops/<name>-<time>.csv', () => {
    const root = mkdtempSync(join(tmpdir(), 'terbit-csv-'))
    try {
      const path = writeCsvReport('demo-csv', ['a'], [['1']], { root, now: new Date('2026-11-05T10:20:30.123Z') })
      expect(path).toBe(join(root, '.evidence', 'uat-ops', 'demo-csv-2026-11-05T10-20-30-123Z.csv'))
      expect(readFileSync(path, 'utf8')).toBe('a\n1\n')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
