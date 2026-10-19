import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { verify } from '@node-rs/argon2'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ANON_EXIT, runAnonymiseCli } from '../../../src/migration/anonymise/cli'
import { patternKinds } from '../../../src/migration/anonymise/leak-scan'
import { DUMMY_ARGON2_HASH, DUMMY_PASSWORD, NOT_A_HASH, dummyBcryptHash } from '../../../src/migration/anonymise/passwords'
import { DirReader } from '../../../src/migration/staging/readers'
import { allText, capture, OTHER_KEY, originalValues, PII, piiTables, readDump, scratch, TEST_KEY, writeDump, type Rows } from './helpers'

const work = scratch()
afterAll(() => work.cleanup())

const env = (extra: Record<string, string> = {}) => ({ ANON_HMAC_KEY: TEST_KEY, ...extra })
const run = (args: string[], e: Record<string, string> = env()) => {
  const log = capture()
  return runAnonymiseCli(['anonymise:run', ...args], { env: e, out: log.out, err: log.err }).then((code) => ({ code, log }))
}

let source: string
let outA: string
let result: Awaited<ReturnType<typeof run>>
const sourceFiles = (dir: string) => Object.fromEntries(readdirSync(dir).sort().map((f) => [f, createHash('sha256').update(readFileSync(join(dir, f))).digest('hex')]))

beforeAll(async () => {
  source = work.out('raw-dump')
  writeDump(source, piiTables())
  outA = work.out('anon-a')
  result = await run(['--source', source, '--out', outA])
})

describe('anonymise:run on a fixture seeded with recognisable fake PII (AC3)', () => {
  it('exits 0 and the leak scan reports clean', () => {
    expect(result.code, result.log.text()).toBe(ANON_EXIT.ok)
    expect(result.log.text()).toMatch(/Leak scan: clean/)
  })

  it('no original value, in any form, appears anywhere in the output (grep of every file)', () => {
    const text = allText(outA)
    const lower = text.toLowerCase()
    for (const original of originalValues()) {
      expect(text.includes(original), `original value leaked: ${original.slice(0, 4)}...`).toBe(false)
      expect(lower.includes(original.toLowerCase()), `original value leaked (case-insensitive): ${original.slice(0, 4)}...`).toBe(false)
    }
  })

  it('no e-mail (other than example.test), phone or IC shape remains in any string of the output', () => {
    const dump = readDump(outA)
    let strings = 0
    const walk = (v: unknown): void => {
      if (typeof v === 'string') {
        strings++
        expect(patternKinds(v), v).toEqual([])
      } else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    for (const rows of Object.values(dump)) rows.forEach(walk)
    expect(strings).toBeGreaterThan(50)
    // and the patterns do catch the originals (the scan is not blind)
    for (const [value, kind] of [[PII.email1, 'email'], [PII.phone1, 'phone'], [PII.phone2, 'phone'], [PII.ic1, 'ic'], [PII.ic2, 'ic']] as const) {
      expect(patternKinds(value), value).toContain(kind)
    }
  })

  it('writes only to the output, mode 0600, and never touches the source', () => {
    const before = sourceFiles(source)
    expect(Object.keys(before)).toContain('users.ndjson')
    const files = readdirSync(outA)
    expect(files).toContain('manifest.json')
    if (process.platform !== 'win32') for (const f of files) expect(statSync(join(outA, f)).mode & 0o777).toBe(0o600)
    expect(sourceFiles(source)).toEqual(before)
  })

  it('the manifest is a pp-staging-dump/1 that DirReader accepts, with the same row counts', async () => {
    const reader = new DirReader(outA)
    const input = readDump(source)
    for (const [table, rows] of Object.entries(input)) {
      expect(reader.expectedRows(table)).toBe(rows.length)
      expect(readDump(outA)[table]).toHaveLength(rows.length)
    }
  })

  it('keeps ids, relations, enums and null positions; replaces personal columns', () => {
    const input = readDump(source)
    const output = readDump(outA)
    for (const [table, rows] of Object.entries(input)) {
      rows.forEach((row, i) => {
        const out = (output[table] as Rows)[i] as Record<string, unknown>
        expect(Object.keys(out), table).toEqual(Object.keys(row))
        for (const [column, value] of Object.entries(row)) {
          if (value === null) expect(out[column], `${table}.${column} null stays null`).toBeNull()
          if (value === '') expect(out[column], `${table}.${column} empty stays empty`).toBe('')
        }
        expect(out.id).toBe(row.id)
      })
    }
    const users = output.users as Rows
    expect(users.map((u) => u.role)).toEqual((input.users as Rows).map((u) => u.role))
    expect(users.map((u) => u.school_id)).toEqual((input.users as Rows).map((u) => u.school_id)) // the orphan school 99 stays an orphan
    expect(users[0]).toMatchObject({ role: 'pelajar', is_active: '1', created_at: '2026-01-01T00:00:00Z' })
    expect(users[0]?.name).toMatch(/^Nama Anon /)
    expect(users[0]?.email).toMatch(/@example\.test$/)
    expect(users[0]?.phone).toMatch(/^00\d{9}$/)
  })

  it('the same person gets the same fake across rows and tables; duplicates stay duplicates, distinct stay distinct', () => {
    const out = readDump(outA)
    const users = out.users as Rows
    // user 3 is user 1 with a case-variant e-mail, other spacing in the name, the same phone digits and IC digits
    expect(users[2]?.email).toBe(users[0]?.email)
    expect(users[2]?.name).toBe(users[0]?.name)
    expect(users[2]?.phone).toBe(users[0]?.phone)
    expect(users[2]?.username).toBe(users[0]?.username)
    expect(String(users[2]?.ic).replace(/\D/g, '')).toBe(String(users[0]?.ic).replace(/\D/g, ''))
    expect(users[1]?.email).not.toBe(users[0]?.email)
    expect(users[1]?.username).not.toBe(users[0]?.username)
    expect(users[3]?.name).toBe(users[4]?.name) // same name, same fake
    // across tables
    expect((out.sponsors as Rows)[0]?.officer_name).toBe(users[1]?.name)
    expect((out.foster_applications as Rows)[0]?.applicant_name).toBe(users[0]?.name)
    expect((out.sponsors as Rows)[0]?.organisation).toBe((out.schools as Rows)[0]?.name)
    expect((out.sponsors as Rows)[0]?.user_id).toBe(2)
    // distinct values: all user e-mails that were distinct stay distinct
    const emails = users.map((u) => u.email).filter((e) => e !== null && e !== '')
    expect(new Set(emails).size).toBe(2)
  })

  it('replaces every password hash with the dummy of its class; no original hash survives (AC4)', async () => {
    const users = readDump(outA).users as Rows
    expect(users.map((u) => u.password)).toEqual([dummyBcryptHash('2y'), dummyBcryptHash('2y'), DUMMY_ARGON2_HASH, NOT_A_HASH, '', null])
    for (const original of [PII.bcryptHash1, PII.bcryptHash2, PII.argonHash, PII.plainPassword]) expect(allText(outA)).not.toContain(original)
    await expect(verify(DUMMY_ARGON2_HASH, DUMMY_PASSWORD)).resolves.toBe(true)
  })

  it('drops remember_token and parent_invite_token (BE-27 M4) and free text, ips and settings values', () => {
    const out = readDump(outA)
    const users = out.users as Rows
    expect(users[0]?.remember_token).toBeNull()
    expect(users[0]?.parent_invite_token).toBeNull()
    expect(users[0]?.bio).toBe('Teks anonim.')
    expect((out.support_tickets as Rows)[0]?.subject).toBe('Teks anonim.')
    expect((out.student_notes as Rows)[0]).toMatchObject({ title: 'Teks anonim.', body: 'Teks anonim.' })
    expect((out.settings as Rows)[0]).toMatchObject({ key: 'openai.api_key', value: 'Teks anonim.' })
    expect((out.audit_logs as Rows)[0]?.ip).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\./)
    expect((out.chatbot_conversations as Rows)[0]?.start_url).toBe('Teks anonim.')
    expect((out.psychometric_results as Rows)[0]?.details).toEqual({ notes: 'Teks anonim.', score: 7, flags: [true, 'Teks anonim.'] })
  })

  it('logs carry counts only: no original value, no pseudonym, no key', () => {
    const text = result.log.text()
    for (const original of originalValues()) expect(text.includes(original)).toBe(false)
    expect(text).not.toContain(TEST_KEY)
    expect(text).not.toMatch(/example\.test|Nama Anon/)
    for (const line of result.log.lines) {
      expect(line, line).toMatch(
        /^(Pseudonymisation key loaded from ANON_HMAC_KEY\.|Anonymised [a-z_]+: \d+ rows\.|Table [a-z_]+ is absent from the input; nothing written for it\.|Leak scan: clean \(\d+ rows, \d+ cells checked\)\.|Done: \d+ tables, \d+ rows\.|Output: \d+ tables, \d+ rows in .+\. Share it out-of-band, encrypted, and delete it after the rehearsal\.)$/,
      )
    }
  })
})

describe('determinism and the key (AC2)', () => {
  it('the same input and key give byte-identical output; another key gives different pseudonyms', async () => {
    const again = work.out('anon-b')
    expect((await run(['--source', source, '--out', again])).code).toBe(ANON_EXIT.ok)
    expect(sourceFiles(again)).toEqual(sourceFiles(outA))

    const other = work.out('anon-other-key')
    expect((await run(['--source', source, '--out', other], env({ ANON_HMAC_KEY: OTHER_KEY }))).code).toBe(ANON_EXIT.ok)
    const a = readDump(outA).users as Rows
    const b = readDump(other).users as Rows
    for (const column of ['name', 'email', 'phone', 'ic', 'username'] as const) {
      expect(b[0]?.[column], column).not.toBe(a[0]?.[column])
      expect(b[1]?.[column], column).not.toBe(a[1]?.[column])
    }
    // the structure is the same
    expect(b.map((u) => u.id)).toEqual(a.map((u) => u.id))
    expect(b.map((u) => u.role)).toEqual(a.map((u) => u.role))
    // and the equal-person relations survive under the other key too
    expect(b[2]?.email).toBe(b[0]?.email)
  })

  it('refuses to run without a key, before reading the source or creating the output', async () => {
    const out = work.out('no-key')
    const r = await run(['--source', source, '--out', out], {})
    expect(r.code).toBe(ANON_EXIT.usage)
    expect(r.log.text()).toMatch(/no pseudonymisation key/)
    expect(existsSync(out)).toBe(false)
    const short = await run(['--source', source, '--out', out], { ANON_HMAC_KEY: 'short' })
    expect(short.code).toBe(ANON_EXIT.usage)
    expect(short.log.text()).not.toMatch(/\bshort\b/)
    expect(existsSync(out)).toBe(false)
  })
})

describe('default deny through the CLI (AC1)', () => {
  it('a config that lacks a rule exits 4, names the column, and reads nothing', async () => {
    const config = JSON.parse(readFileSync(new URL('../../../src/migration/anonymise/anon.config.json', import.meta.url), 'utf8')) as { tables: Record<string, Record<string, unknown>> }
    delete (config.tables.users as Record<string, unknown>).email
    delete (config.tables.settings as Record<string, unknown>).value
    const cfg = work.out('missing-rule.json')
    writeFileSync(cfg, JSON.stringify(config))
    const out = work.out('deny')
    const r = await run(['--source', source, '--out', out, '--config', cfg])
    expect(r.code).toBe(ANON_EXIT.coverage)
    expect(r.log.text()).toContain('users.email')
    expect(r.log.text()).toContain('settings.value')
    expect(existsSync(out)).toBe(false)
  })

  it('a column in the input that the DDL does not know exits 1, names the column, and deletes the partial output', async () => {
    const dump = work.out('extra-column')
    const tables = piiTables()
    ;(tables.users as Rows)[0] = { ...(tables.users as Rows)[0], shoe_size_note: PII.name2 }
    writeDump(dump, tables)
    const out = work.out('extra-out')
    const r = await run(['--source', dump, '--out', out])
    expect(r.code).toBe(ANON_EXIT.failed)
    expect(r.log.text()).toContain('shoe_size_note')
    expect(r.log.text()).not.toContain(PII.name2)
    expect(readdirSync(out)).toEqual([])
  })
})

describe('output guards', () => {
  it('refuses an output outside .migration-out, a non-empty one, and one that overlaps the source', async () => {
    const outside = work.outside('anon')
    const r1 = await run(['--source', source, '--out', outside])
    expect(r1.code).toBe(ANON_EXIT.failed)
    expect(r1.log.text()).toMatch(/\.migration-out/)
    expect(existsSync(outside)).toBe(false)

    const busy = work.out('busy')
    mkdirSync(busy)
    writeFileSync(join(busy, 'old.txt'), 'old')
    const r2 = await run(['--source', source, '--out', busy])
    expect(r2.code).toBe(ANON_EXIT.failed)
    expect(r2.log.text()).toMatch(/not empty/)
    expect(readdirSync(busy)).toEqual(['old.txt'])

    const before = sourceFiles(source)
    const r3 = await run(['--source', source, '--out', join(source, 'nested')])
    expect(r3.code).toBe(ANON_EXIT.failed)
    expect(r3.log.text()).toMatch(/overlap/)
    const r4 = await run(['--source', source, '--out', source])
    expect(r4.code).toBe(ANON_EXIT.failed)
    expect(sourceFiles(source)).toEqual(before)
  })

  it('does not accept a connection string on the command line and never echoes one', async () => {
    const url = 'postgresql://reader:Hunter2Password@db.example.org:5432/cloud'
    const r = await run(['--source', url, '--out', work.out('url')])
    expect(r.code).toBe(ANON_EXIT.usage)
    expect(r.log.text()).not.toContain('Hunter2Password')
    expect(r.log.text()).not.toContain('reader')
    const none = await run(['--source', 'pg', '--out', work.out('nourl')])
    expect(none.code).toBe(ANON_EXIT.usage)
    expect(none.log.text()).toMatch(/CLOUD_SOURCE_URL is not set/)
  })

  it('usage errors: unknown flag, missing flags', async () => {
    expect((await run(['--source', source, '--out', work.out('x'), '--force'])).code).toBe(ANON_EXIT.usage)
    expect((await run(['--out', work.out('x2')])).code).toBe(ANON_EXIT.usage)
    expect((await run(['--source', source])).code).toBe(ANON_EXIT.usage)
    expect((await runAnonymiseCli(['frobnicate'], { env: env(), out: () => undefined, err: () => undefined }))).toBe(ANON_EXIT.usage)
  })
})

describe('the leak scan fails closed (AC3)', () => {
  // A deliberate configuration mistake: the column is kept although it holds personal data.
  const withKeptColumn = (tables: Record<string, Rows>, patch: Record<string, unknown>) => {
    ;(tables.users as Rows)[3] = { ...(tables.users as Rows)[3], ...patch }
    return tables
  }

  it.each([
    ['an IC number in a kept column', { kelas: 'Murid 010101-01-0101' }, 'ic'],
    ['an e-mail address in a kept column', { kelas: `hubungi ${PII.email2}` }, 'email'],
    ['a phone number in a kept column', { kelas: 'tel 012-3456789' }, 'phone'],
    ['an original value copied into a kept column', { kelas: PII.name2 }, 'original-value'],
    ['an original name inside longer kept text', { kelas: `Guru kelas ialah ${PII.name2} dari sekolah` }, 'original-name'],
    ['an original phone number with other punctuation', { kelas: 'No: 011 3333 4444 (ibu)' }, 'phone'],
  ])('fails on %s, deletes the output and names the column but not the value', async (_label, patch, kind) => {
    const dump = work.out(`leak-src-${kind}`)
    writeDump(dump, withKeptColumn(piiTables(), patch))
    const out = work.out(`leak-out-${kind}`)
    const r = await run(['--source', dump, '--out', out])
    expect(r.code, r.log.text()).toBe(ANON_EXIT.leak)
    expect(r.log.text()).toContain('users.kelas')
    expect(r.log.text()).toContain(kind)
    expect(r.log.text()).toMatch(/output was deleted/)
    for (const v of Object.values(patch)) expect(r.log.text().includes(String(v))).toBe(false)
    expect(readdirSync(out)).toEqual([])
  })

  it('a copy of an original value in a kept column of ANOTHER table is found too', async () => {
    const tables = piiTables()
    ;(tables.settings as Rows).push({ id: 2, key: 'contact', value: 'x', group: 'umum' })
    ;(tables.schools as Rows)[0] = { ...(tables.schools as Rows)[0], state: PII.username2 } // kept enum-like column
    const dump = work.out('leak-src-other')
    writeDump(dump, tables)
    const r = await run(['--source', dump, '--out', work.out('leak-out-other')])
    expect(r.code).toBe(ANON_EXIT.leak)
    expect(r.log.text()).toContain('schools.state')
  })

  it('anonymise:scan finds personal-looking data in a finished dump and passes a clean one', async () => {
    const dirty = work.out('scan-dirty')
    writeDump(dirty, { users: [{ id: 1, name: 'Nama Anon X', kelas: PII.email1, school_id: 1 }] })
    const log = capture()
    expect(await runAnonymiseCli(['anonymise:scan', '--dir', dirty], { env: {}, out: log.out, err: log.err })).toBe(ANON_EXIT.leak)
    expect(log.text()).toContain('users.kelas')
    expect(log.text()).not.toContain(PII.email1)

    const log2 = capture()
    expect(await runAnonymiseCli(['anonymise:scan', '--dir', outA], { env: {}, out: log2.out, err: log2.err })).toBe(ANON_EXIT.ok)
    const log3 = capture()
    expect(await runAnonymiseCli(['anonymise:scan', '--dir', dirty, '--allow-email-domains', 'leak-check.invalid'], { env: {}, out: log3.out, err: log3.err })).toBe(ANON_EXIT.ok)
  })
})
