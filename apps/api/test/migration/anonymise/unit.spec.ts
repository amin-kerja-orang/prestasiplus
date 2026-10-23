import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { verify } from '@node-rs/argon2'
import { afterAll, describe, expect, it } from 'vitest'

import { findTable, TABLES, type TableSpec } from '../../../src/migration/ddl/spec'
import { ConfigError, CoverageError, KeyError } from '../../../src/migration/anonymise/errors'
import { loadHmacKey } from '../../../src/migration/anonymise/key'
import { OriginalsIndex, patternKinds } from '../../../src/migration/anonymise/leak-scan'
import { DUMMY_ARGON2_HASH, DUMMY_PASSWORD, dummyPasswordHash, NOT_A_HASH } from '../../../src/migration/anonymise/passwords'
import { Pseudonymiser, PSEUDONYM_KINDS } from '../../../src/migration/anonymise/pseudonyms'
import { applyRule, checkCoverage, findCoverageGaps, parseConfig, ruleFor, type AnonConfig } from '../../../src/migration/anonymise/rules'
import { OTHER_KEY, scratch, TEST_KEY } from './helpers'

const DEFAULT_CONFIG = parseConfig(JSON.parse(readFileSync(fileURLToPath(new URL('../../../src/migration/anonymise/anon.config.json', import.meta.url)), 'utf8')))
const key = (text: string) => Buffer.from(text, 'utf8')
const work = scratch()
afterAll(() => work.cleanup())

describe('default deny (AC1)', () => {
  it('the shipped config covers every column of the staging DDL and names nothing else', () => {
    expect(findCoverageGaps(TABLES, DEFAULT_CONFIG)).toEqual({ uncovered: [], unknown: [] })
    expect(() => checkCoverage(TABLES, DEFAULT_CONFIG)).not.toThrow()
  })

  it('a synthetic DDL with a column that has no rule is refused and the column is named', () => {
    const users = findTable('users') as TableSpec
    const synthetic: TableSpec = { ...users, columns: [...users.columns, { name: 'shoe_size_note', type: 't', enum: false, fk: null, redact: false }] }
    let error: unknown
    try {
      checkCoverage([synthetic], DEFAULT_CONFIG)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CoverageError)
    expect((error as CoverageError).uncovered).toEqual(['users.shoe_size_note'])
    expect((error as Error).message).toContain('users.shoe_size_note')
  })

  it('a rule for a column or table that the DDL does not have is an error too (stale rule)', () => {
    const config: AnonConfig = { ...DEFAULT_CONFIG, tables: { ...DEFAULT_CONFIG.tables, ghost_table: { x: { rule: 'keep' } } } }
    config.tables.users = { ...DEFAULT_CONFIG.tables.users, ghost_column: { rule: 'keep' } }
    const gaps = findCoverageGaps(TABLES, config)
    expect(gaps.unknown.sort()).toEqual(['ghost_table.*', 'users.ghost_column'])
  })

  it('every DDL column has an explicit per-table rule and every config column exists in the DDL (no drift either way)', () => {
    // Only id, created_at and updated_at may rely on the `global` rules; every other column needs its own entry.
    const globalOk = new Set(['id', 'created_at', 'updated_at'])
    const missing: string[] = []
    for (const spec of TABLES) {
      const rules = DEFAULT_CONFIG.tables[spec.name] ?? {}
      for (const col of spec.columns) {
        if (!(col.name in rules) && !globalOk.has(col.name)) missing.push(`${spec.name}.${col.name}`)
      }
    }
    expect(missing, 'spec columns without an explicit rule in anon.config.json').toEqual([])
    const stale: string[] = []
    const specByName = new Map(TABLES.map((s) => [s.name, new Set(s.columns.map((c) => c.name))]))
    for (const [table, rules] of Object.entries(DEFAULT_CONFIG.tables)) {
      const cols = specByName.get(table)
      if (!cols) {
        stale.push(`${table}.*`)
        continue
      }
      for (const col of Object.keys(rules)) if (!cols.has(col)) stale.push(`${table}.${col}`)
    }
    expect(stale, 'anon.config.json columns that are not in ddl/spec.ts').toEqual([])
  })

  it('every personal column of the DDL has a rule that is not "keep"', () => {
    const mustChange: [string, string][] = [
      ['users', 'name'], ['users', 'email'], ['users', 'phone'], ['users', 'ic'], ['users', 'username'], ['users', 'password'],
      ['users', 'remember_token'], ['users', 'parent_invite_token'], ['users', 'google_id'], ['users', 'referral_code'], ['users', 'bio'],
      ['users', 'faith'], ['sponsors', 'officer_name'], ['sponsors', 'organisation'], ['foster_applications', 'applicant_name'],
      ['foster_applications', 'reason'], ['support_tickets', 'subject'], ['support_tickets', 'admin_reply'], ['student_notes', 'body'],
      ['mood_checkins', 'note'], ['feedback', 'comment'], ['chatbot_messages', 'body'], ['chatbot_conversations', 'visitor_id'],
      ['audit_logs', 'ip'], ['settings', 'value'], ['psychometric_results', 'details'], ['part_responses', 'response'],
      ['structured_attempt_answers', 'answer'], ['schools', 'name'], ['schools', 'join_code'], ['marketplace_sellers', 'organisation'],
    ]
    for (const [t, c] of mustChange) {
      // Strict: the column must exist in the DDL and have an explicit rule (an undefined rule is not "not keep").
      expect(findTable(t)?.columns.some((col) => col.name === c), `${t}.${c} is not in the DDL`).toBe(true)
      const rule = DEFAULT_CONFIG.tables[t]?.[c]
      expect(rule, `${t}.${c} has no explicit rule`).toBeDefined()
      expect(rule?.rule, `${t}.${c}`).not.toBe('keep')
    }
    expect(ruleFor(DEFAULT_CONFIG, 'users', 'password')?.rule).toBe('hash-password-dummy')
    expect(ruleFor(DEFAULT_CONFIG, 'users', 'remember_token')?.rule).toBe('null')
    expect(ruleFor(DEFAULT_CONFIG, 'users', 'parent_invite_token')?.rule).toBe('null')
  })

  it('parses dummyPasswordRoles and leakScan.allow, and rejects bad ones', () => {
    const base = { version: 1, tables: {} }
    expect(parseConfig(base)).toMatchObject({ dummyPasswordRoles: ['pelajar', 'guru', 'ibu_bapa'], leakScan: { allow: [] } })
    expect(parseConfig({ ...base, leakScan: { allow: ['users.kelas'] } }).leakScan.allow).toEqual(['users.kelas'])
    expect(() => parseConfig({ ...base, leakScan: { allow: ['kelas'] } })).toThrow(/leakScan/)
    expect(() => parseConfig({ ...base, dummyPasswordRoles: 'admin' })).toThrow(/dummyPasswordRoles/)
    const cfg = { ...DEFAULT_CONFIG, leakScan: { allow: ['users.ghost'] } }
    expect(findCoverageGaps(TABLES, cfg).unknown).toEqual(['users.ghost'])
    expect(DEFAULT_CONFIG.leakScan.allow).toEqual([])
  })

  it('the shipped config covers the quasi-identifier and upload columns (M4)', () => {
    const expected: [string, string, string][] = [
      ['practice_sessions', 'client_uuid', 'pseudonym'], ['audit_logs', 'subject_id', 'pseudonym'], ['users', 'spm_targets', 'scrub-text'], ['challenges', 'target_value', 'keep'], ['challenges', 'title', 'scrub-text'],
      ['notifications', 'title', 'scrub-text'], ['notifications', 'target', 'scrub-text'], ['media_assets', 'path', 'pseudonym'],
      ['paper_documents', 'source_file', 'pseudonym'], ['paper_document_pages', 'path', 'pseudonym'], ['banners', 'image_path', 'pseudonym'],
      ['audio_kbat', 'audio_path', 'pseudonym'],
    ]
    for (const [t, c, r] of expected) expect(ruleFor(DEFAULT_CONFIG, t, c)?.rule, `${t}.${c}`).toBe(r)
  })

  it('rejects a malformed config without echoing values', () => {
    expect(() => parseConfig(null)).toThrow(ConfigError)
    expect(() => parseConfig({ version: 2, tables: {} })).toThrow(/version/)
    expect(() => parseConfig({ version: 1, tables: { users: { name: 'pseudonym:secret-kind' } } })).toThrow(/unknown pseudonym kind/)
    expect(() => parseConfig({ version: 1, tables: { users: { name: 'shred' } } })).toThrow(/unknown rule/)
    expect(() => parseConfig({ version: 1, tables: { Users: {} } })).toThrow(/snake_case/)
    expect(() => parseConfig({ version: 1, tables: {}, extra: 1 })).toThrow(/unknown top-level/)
  })
})

describe('rules keep structure', () => {
  const p = new Pseudonymiser(key(TEST_KEY))
  const apply = (rule: AnonConfig['global'][string], v: unknown) => applyRule(rule, v, p)

  it('NULL and empty text stay as they are, so null ratios survive', () => {
    for (const rule of [{ rule: 'pseudonym', kind: 'email' }, { rule: 'scrub-text' }, { rule: 'hash-password-dummy' }, { rule: 'fixed', value: 'x' }] as const) {
      expect(apply(rule, null)).toBeNull()
    }
    expect(apply({ rule: 'pseudonym', kind: 'name' }, '')).toBe('')
    expect(apply({ rule: 'scrub-text' }, '')).toBe('')
    expect(apply({ rule: 'null' }, 'anything')).toBeNull()
    expect(apply({ rule: 'keep' }, 'kept')).toBe('kept')
    expect(apply({ rule: 'fixed', value: 'tetap' }, 'asal')).toBe('tetap')
  })

  it('scrub-text keeps the shape of json: strings replaced, numbers and booleans kept', () => {
    expect(apply({ rule: 'scrub-text' }, { a: 'secret', n: 3, b: true, list: ['x', 1, null], deep: { s: 'y' } })).toEqual({
      a: 'Teks anonim.', n: 3, b: true, list: ['Teks anonim.', 1, null], deep: { s: 'Teks anonim.' },
    })
  })
})

describe('scrub-json', () => {
  const p = new Pseudonymiser(key(TEST_KEY))
  const rule = { rule: 'scrub-json' } as const
  const apply = (v: unknown) => applyRule(rule, v, p)
  const criteria = '{"type":"questions","target_value":50,"daily":true,"note":"Untuk Aina Contoh Fiktif","tags":["Kelas 5 Fiktif",3,null],"deep":{"who":"Budi Contoh","n":1.5}}'

  it('keeps keys, numbers, booleans and null; every nested string leaf is scrubbed', () => {
    const out = apply(criteria) as string
    expect(typeof out).toBe('string')
    expect(JSON.parse(out)).toEqual({
      type: 'Teks anonim.', target_value: 50, daily: true, note: 'Teks anonim.', tags: ['Teks anonim.', 3, null], deep: { who: 'Teks anonim.', n: 1.5 },
    })
  })

  it('no original string value or name survives in the output', () => {
    const out = apply(criteria) as string
    for (const original of ['Aina Contoh Fiktif', 'Kelas 5 Fiktif', 'Budi Contoh', 'Aina', 'Budi']) expect(out).not.toContain(original)
  })

  it('an already parsed value is handled the same way', () => {
    expect(apply(JSON.parse(criteria))).toEqual(JSON.parse(apply(criteria) as string))
  })

  it('numbers and booleans at the top level are kept', () => {
    expect(apply('50')).toBe('50')
    expect(apply('false')).toBe('false')
    expect(apply('"Aina Contoh"')).toBe('"Teks anonim."')
  })

  it('NULL stays NULL and empty text stays empty', () => {
    expect(apply(null)).toBeNull()
    expect(apply(undefined)).toBeNull()
    expect(apply('')).toBe('')
  })

  it('a value that is not valid JSON is replaced exactly as scrub-text would (fail closed)', () => {
    for (const bad of ['Aina bin Contoh', '{"target_value": 5, "note": "Aina"', "{'a': 'Aina'}", '  ', '{"a":1} trailing Aina']) {
      expect(apply(bad), bad).toBe(applyRule({ rule: 'scrub-text' }, bad, p))
      expect(apply(bad), bad).toBe('Teks anonim.')
    }
  })

  it('is deterministic for the same input and key', () => {
    const other = new Pseudonymiser(key(TEST_KEY))
    expect(apply(criteria)).toBe(applyRule(rule, criteria, other))
    expect(apply(criteria)).toBe(apply(criteria))
  })

  it('the leak index records the string leaves of the original json text, and the scrubbed output is clean', () => {
    const original = '{"target_value":5,"note":"Catatan untuk Aina Contoh Fiktif sahaja"}'
    const out = apply(original)
    const index = new OriginalsIndex()
    index.record(rule, original, out)
    expect(index.size).toBeGreaterThan(0)
    expect(index.match('Catatan untuk Aina Contoh Fiktif sahaja')).toBe('original-value')
    expect(index.match(out as string)).toBeNull()
  })
})

describe('pseudonyms (AC2)', () => {
  const sample = (kind: (typeof PSEUDONYM_KINDS)[number], i: number): string =>
    kind === 'phone' ? `01${String(i).padStart(9, '3')}` : kind === 'ic' ? `${String(i).padStart(12, '5')}` : `Value ${i} Example`

  it('is deterministic for one key, and different for another key', () => {
    const a1 = new Pseudonymiser(key(TEST_KEY))
    const a2 = new Pseudonymiser(key(TEST_KEY))
    const b = new Pseudonymiser(key(OTHER_KEY))
    for (const kind of PSEUDONYM_KINDS) {
      const v = sample(kind, 7)
      expect(a1.apply(kind, v), kind).toBe(a2.apply(kind, v))
      expect(a1.apply(kind, v), kind).not.toBe(b.apply(kind, v))
    }
  })

  it('treats case, spacing and phone/IC punctuation as the same person', () => {
    const p = new Pseudonymiser(key(TEST_KEY))
    expect(p.apply('email', 'Some.One@Example.org')).toBe(p.apply('email', ' some.one@example.ORG '))
    expect(p.apply('name', 'Aaa  Bbb')).toBe(p.apply('name', 'aaa bbb'))
    expect(p.apply('phone', '012-345 6789')).toBe(p.apply('phone', '0123456789'))
    // L5: the country code and the leading 0 are the same number
    expect(p.apply('phone', '+60 12-345 6789')).toBe(p.apply('phone', '0123456789'))
    expect(p.apply('phone', '60123456789')).toBe(p.apply('phone', '0123456789'))
    expect(p.apply('phone', '+60 12-345 67890')).toBe(p.apply('phone', '0123456 7890'))
    expect(p.apply('phone', '6012345678')).not.toBe(p.apply('phone', '012345678')) // 10 digits starting 60 is not a +60 number
    expect(p.apply('phone', '0123456789')).not.toBe(p.apply('phone', '0123456780'))
    expect((p.apply('ic', '010101-01-0101') as string).replace(/\D/g, '')).toBe((p.apply('ic', '010101010101') as string).replace(/\D/g, ''))
    expect(p.apply('email', 'a@b.org')).not.toBe(p.apply('email', 'c@d.org'))
  })

  it('does not reuse one fake for two kinds, and the fake does not contain the input', () => {
    const p = new Pseudonymiser(key(TEST_KEY))
    expect(p.apply('name', 'same')).not.toBe(p.apply('org', 'same'))
    expect(p.apply('username', 'zanthor_m') as string).not.toContain('zanthor')
  })

  it('every fake is obviously fictitious: reserved domain, no real phone or IC shape, 5000 samples per kind', () => {
    const p = new Pseudonymiser(key(TEST_KEY))
    const seen = new Set<string>()
    for (let i = 0; i < 5000; i++) {
      const email = p.apply('email', `user${i}@x.org`) as string
      expect(email).toMatch(/^anon-[a-z2-7]{12}@example\.test$/)
      expect(patternKinds(email)).toEqual([])
      const phone = p.apply('phone', `01${String(i).padStart(9, '4')}`) as string
      expect(phone).toMatch(/^00\d{13}$/)
      expect(patternKinds(phone), phone).toEqual([])
      const ic = p.apply('ic', String(i).padStart(12, '6')) as string
      expect(ic).toMatch(/^\d{2}00\d{2}00\d{4}$/)
      expect(patternKinds(ic), ic).toEqual([])
      const icDash = p.apply('ic', `${String(i).padStart(6, '7')}-01-${String(i).padStart(4, '8')}`) as string
      expect(icDash).toMatch(/^\d{2}00\d{2}-00-\d{4}$/)
      expect(patternKinds(icDash), icDash).toEqual([])
      expect(p.apply('name', `n${i}`)).toMatch(/^Nama Anon [A-Z2-7]{10}$/)
      expect(p.apply('org', `o${i}`)).toMatch(/^Organisasi Anon [A-Z2-7]{10}$/)
      expect(p.apply('username', `u${i}`)).toMatch(/^anon_[a-z2-7]{10}$/)
      expect(p.apply('code', `c${i}`)).toMatch(/^[A-Z2-7]{8}$/)
      expect(p.apply('opaque', `o${i}`)).toMatch(/^[a-z2-7]{20}$/)
      expect(p.apply('ip', `10.0.${i % 250}.${i % 200}`)).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/)
      seen.add(email)
    }
    expect(seen.size).toBe(5000) // distinct inputs stay distinct
  })

  it('M1: 100,000 distinct ICs and 100,000 distinct phones never abort, stay distinct and never match a leak pattern', () => {
    const p = new Pseudonymiser(key(TEST_KEY))
    const ics = new Set<string>()
    const phones = new Set<string>()
    let bad = 0
    for (let i = 0; i < 100_000; i++) {
      const ic = p.apply('ic', String(100_000_000_000 + i * 7919)) as string
      const phone = p.apply('phone', `01${String(i).padStart(9, '0')}`) as string
      ics.add(ic)
      phones.add(phone)
      if (!/^\d{2}00\d{2}00\d{4}$/.test(ic) || !/^00\d{13}$/.test(phone) || patternKinds(ic).length > 0 || patternKinds(phone).length > 0) bad++
    }
    expect(ics.size).toBe(100_000)
    expect(phones.size).toBe(100_000)
    expect(bad).toBe(0)
    expect(p.rehashed).toBeGreaterThan(0) // 100k of 10^8 ICs: collisions did happen and were resolved
    // the choice is stable: asking again gives the same fake
    const one = String(100_000_000_000 + 5 * 7919)
    expect(p.apply('ic', one)).toBe(p.apply('ic', one))
    // a second run over the same input in the same order reproduces the same fakes
    const again = new Pseudonymiser(key(TEST_KEY))
    for (let i = 0; i < 20_000; i++) again.apply('ic', String(100_000_000_000 + i * 7919))
    for (let i = 0; i < 20_000; i += 997) expect(again.apply('ic', String(100_000_000_000 + i * 7919))).toBe(p.apply('ic', String(100_000_000_000 + i * 7919)))
  }, 60_000)

  it('path keeps the extension and hides the name', () => {
    const p = new Pseudonymiser(key(TEST_KEY))
    expect(p.apply('path', 'uploads/Ali Rapor.PDF')).toMatch(/^files\/[a-z2-7]{20}\.pdf$/)
    expect(p.apply('path', 'x/y/photo.jpeg?v=2')).toMatch(/\.jpeg$/)
    expect(p.apply('path', 'noext')).toMatch(/^files\/[a-z2-7]{20}$/)
    expect(p.apply('path', 'uploads/Ali Rapor.PDF') as string).not.toMatch(/ali|rapor/i)
  })

  it('refuses a key that is too short', () => {
    expect(() => new Pseudonymiser(key('short'))).toThrow(/too short/)
  })
})

describe('passwords (AC4)', () => {
  it('replaces every hash class with the dummy of the same class and never keeps the original', () => {
    expect(dummyPasswordHash(null)).toBeNull()
    expect(dummyPasswordHash('')).toBe('')
    expect(dummyPasswordHash('$2y$10$' + 'x'.repeat(53))).toMatch(/^\$2y\$10\$1BYJgcHHYPQGKg8zT39ARe/)
    expect(dummyPasswordHash('$2b$10$' + 'x'.repeat(53))).toMatch(/^\$2b\$10\$/)
    expect(dummyPasswordHash('$argon2id$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA')).toBe(DUMMY_ARGON2_HASH)
    expect(dummyPasswordHash('$weird$thing')).toBe(DUMMY_ARGON2_HASH)
    expect(dummyPasswordHash('letmein')).toBe(NOT_A_HASH)
    // M2: a locked (privileged) account never gets the known dummy hash
    expect(dummyPasswordHash(`$2y$10$${'x'.repeat(53)}`, true)).toBe(NOT_A_HASH)
    expect(dummyPasswordHash(null, true)).toBeNull()
    expect(dummyPasswordHash('', true)).toBe('')
  })

  it('the documented dummy password verifies against the argon2 dummy', async () => {
    expect(DUMMY_PASSWORD).toBe('Demo1234')
    await expect(verify(DUMMY_ARGON2_HASH, DUMMY_PASSWORD)).resolves.toBe(true)
    await expect(verify(DUMMY_ARGON2_HASH, 'wrong')).resolves.toBe(false)
  })
})

describe('the key (OD-18)', () => {
  it('refuses to run without a key, with both set, or with a short key; the message never repeats a key', () => {
    expect(() => loadHmacKey({})).toThrow(KeyError)
    expect(() => loadHmacKey({ ANON_HMAC_KEY: '' })).toThrow(/no pseudonymisation key/)
    expect(() => loadHmacKey({ ANON_HMAC_KEY: TEST_KEY, ANON_HMAC_KEY_FILE: '/x' })).toThrow(/not both/)
    let message = ''
    try {
      loadHmacKey({ ANON_HMAC_KEY: 'too-short-secret' })
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toMatch(/at least 32/)
    expect(message).not.toContain('too-short-secret')
  })

  it('reads the key from the environment or from a file outside the repository', () => {
    expect(loadHmacKey({ ANON_HMAC_KEY: TEST_KEY }).key.toString()).toBe(TEST_KEY)
    const file = work.outside('key.txt')
    writeFileSync(file, `${TEST_KEY}\n`, { mode: 0o600 })
    chmodSync(file, 0o600)
    const loaded = loadHmacKey({ ANON_HMAC_KEY_FILE: file })
    expect(loaded.key.toString()).toBe(TEST_KEY)
    expect(loaded.origin).toBe('file')
  })

  it('refuses a key file inside the repository', () => {
    const inside = work.out('key.txt')
    writeFileSync(inside, TEST_KEY, { mode: 0o600 })
    expect(() => loadHmacKey({ ANON_HMAC_KEY_FILE: inside })).toThrow(/inside the repository/)
    expect(() => loadHmacKey({ ANON_HMAC_KEY_FILE: work.outside('missing.txt') })).toThrow(/does not name a readable file/)
  })

  it.skipIf(process.platform === 'win32')('refuses a key file that other users can read', () => {
    const file = work.outside('open-key.txt')
    writeFileSync(file, TEST_KEY)
    chmodSync(file, 0o644)
    expect(() => loadHmacKey({ ANON_HMAC_KEY_FILE: file })).toThrow(/chmod 600/)
  })
})
