import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

import { patternKinds } from '../../../src/migration/anonymise/leak-scan'
import { TABLES } from '../../../src/migration/ddl/spec'
import { FIXTURE_EXIT, FixtureOutputError, runFixturesCli, writeFixture } from '../../../src/migration/fixtures/cli'
import {
  ANOMALIES_FORMAT,
  DEFAULT_HASH,
  FICTITIOUS_DOMAIN,
  fixtureFiles,
  generateFixture,
  SIZE_SPECS,
  UNKNOWN_COIN_TYPE,
  UNKNOWN_MODE,
  UNKNOWN_ROLE,
  type Row,
} from '../../../src/migration/fixtures/generate'
import { DirReader } from '../../../src/migration/staging/readers'
import { scratch } from '../anonymise/helpers'

const work = scratch()
afterAll(() => work.cleanup())

const FIXTURES_ROOT = fileURLToPath(new URL('./', import.meta.url))
const MIGRATION_TEST_ROOT = fileURLToPath(new URL('../', import.meta.url))
const TINY_DIR = join(FIXTURES_ROOT, 'tiny')

const same = (a: Map<string, string>, b: Map<string, string>) => {
  expect([...a.keys()]).toEqual([...b.keys()])
  for (const [k, v] of a) expect(v === b.get(k), k).toBe(true)
}

describe('determinism (BE-MIG-15)', () => {
  it('the same size and seed give byte-identical files; another seed or size gives different data', () => {
    same(fixtureFiles(generateFixture('tiny', 1)), fixtureFiles(generateFixture('tiny', 1)))
    const other = fixtureFiles(generateFixture('tiny', 2))
    const base = fixtureFiles(generateFixture('tiny', 1))
    expect(other.get('question_attempts.ndjson')).not.toBe(base.get('question_attempts.ndjson'))
    expect(fixtureFiles(generateFixture('small', 1)).get('users.ndjson')).not.toBe(base.get('users.ndjson'))
  })

  it('the committed tiny sample is exactly what the generator writes for seed 1', () => {
    const files = fixtureFiles(generateFixture('tiny', 1))
    expect(readdirSync(TINY_DIR).sort()).toEqual([...files.keys()].sort())
    for (const [name, content] of files) expect(readFileSync(join(TINY_DIR, name), 'utf8').replace(/\r\n/g, '\n') === content, name).toBe(true)
  })

  it('writes the pp-staging-dump/1 shape: every table of the spec is in the manifest and DirReader accepts it', async () => {
    const files = fixtureFiles(generateFixture('tiny', 1))
    const manifest = JSON.parse(files.get('manifest.json') as string) as { format: string; source: string; synthetic: boolean; tables: Record<string, { rows: number }> }
    expect(manifest).toMatchObject({ format: 'pp-staging-dump/1', source: 'cloud', synthetic: true })
    expect(Object.keys(manifest.tables).sort()).toEqual(TABLES.map((t) => t.name).sort())
    const reader = new DirReader(TINY_DIR)
    for (const t of TABLES) expect(reader.expectedRows(t.name)).toBe(manifest.tables[t.name]?.rows)
  })

  it('refuses a bad size or seed', () => {
    expect(() => generateFixture('huge' as never, 1)).toThrow(/tiny, small or medium/)
    expect(() => generateFixture('tiny', -1)).toThrow(/seed/)
    expect(() => generateFixture('tiny', 1.5)).toThrow(/seed/)
  })
})

describe('size limits (BE-NFR-13, AC6)', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

  it('no file under apps/api/test/migration is over 1 MB, and the tiny sample is far below', () => {
    const files = walk(MIGRATION_TEST_ROOT).filter((f) => !f.includes('.migration-out'))
    expect(files.length).toBeGreaterThan(40)
    for (const f of files) expect(statSync(f).size, f).toBeLessThanOrEqual(1_000_000)
    const total = walk(TINY_DIR).reduce((sum, f) => sum + statSync(f).size, 0)
    expect(total).toBeLessThan(1_000_000)
  })

  it('writing a size that would exceed 1 MB into the committed tree is refused and writes nothing', () => {
    const target = join(FIXTURES_ROOT, '_too-big-test')
    expect(() => writeFixture('small', 1, target)).toThrow(FixtureOutputError)
    expect(existsSync(target)).toBe(false)
  })

  it('the three sizes have the promised user counts', () => {
    expect(SIZE_SPECS.tiny.users).toBe(100)
    expect(generateFixture('small', 3).tables.get('users')).toHaveLength(SIZE_SPECS.small.users)
  })
})

// ---------------------------------------------------------------------------------------------------------
const NAME = /^(Murid|Guru|Penjaga|Pengguna) Contoh \d{5}$/
// A deny-list of very common given names and surnames: none may appear as a word anywhere in a fixture.
const DENY = /\b(ahmad|muhammad|mohammad|mohd|abdul|abdullah|siti|nurul|nur|aisyah|fatimah|ali|hassan|hussein|lim|tan|wong|lee|chong|kumar|raj|singh|kaur|devi|krishnan|tengku|syed|sharifah|binti|bin|a\/l|a\/p)\b/i

const asRows = (f: ReturnType<typeof generateFixture>, t: string): Row[] => f.tables.get(t) ?? []
function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const x of v) yield* strings(x)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x)
}

describe.each(['tiny', 'small'] as const)('fictitious data only (%s, AC6)', (size) => {
  const fx = generateFixture(size, 11)

  it('names, e-mails, phones and IC numbers have the obviously fake shapes', () => {
    for (const u of asRows(fx, 'users')) {
      expect(String(u.name)).toMatch(NAME)
      if (u.email !== null) expect(String(u.email).toLowerCase()).toMatch(new RegExp(`^pengguna\\d{5}@${FICTITIOUS_DOMAIN.replace('.', '\\.')}$`))
      expect(String(u.phone)).toMatch(/^00\d{9}$/)
      expect(String(u.ic)).toMatch(/^0000000\d{5}$/)
      expect(String(u.password ?? '')).not.toMatch(/^\$2y\$10\$(?![FD])/)
    }
    for (const s of asRows(fx, 'schools')) expect(String(s.name)).toMatch(/^Sekolah Contoh \d{3}$/)
  })

  it('no word of any value is a common real name (deny-list), and no real-looking e-mail, phone or IC appears', () => {
    let checked = 0
    for (const spec of TABLES) {
      for (const row of asRows(fx, spec.name)) {
        for (const value of Object.values(row)) {
          for (const s of strings(value)) {
            checked++
            expect(DENY.test(s), `${spec.name}: ${s}`).toBe(false)
            expect(patternKinds(s, { allowedEmailDomains: [FICTITIOUS_DOMAIN] }), `${spec.name}: ${s}`).toEqual([])
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })
})

// ---------------------------------------------------------------------------------------------------------
describe.each(['tiny', 'small'] as const)('planted anomalies match a scan of the rows (%s, BE-MIG-15)', (size) => {
  const fx = generateFixture(size, 5)
  const { planted, scanned } = fx.anomalies
  const B = SIZE_SPECS[size].scale

  it('has the manifest format and the row counts of the tables', () => {
    expect(fx.anomalies.format).toBe(ANOMALIES_FORMAT)
    for (const spec of TABLES) expect(fx.anomalies.rows[spec.name], spec.name).toBe(asRows(fx, spec.name).length)
  })

  it('orphans: every planted orphan is found, and nothing else is orphaned', () => {
    expect(scanned.orphans).toEqual(planted.orphans)
    expect(planted.orphans['question_attempts.question_id']).toBe(3 * B) // attempts whose legacy question is missing
    expect(planted.orphans['users.school_id']).toBe(2 * B)
  })

  it('duplicate e-mails (case variants and exact copies) and duplicate (school, username)', () => {
    expect(scanned.duplicateEmail).toEqual(planted.duplicateEmail)
    expect(scanned.duplicateSchoolUsername).toEqual(planted.duplicateSchoolUsername)
    const users = asRows(fx, 'users')
    const emails = users.filter((u) => typeof u.email === 'string')
    const exact = new Set(emails.map((u) => u.email))
    const lower = new Set(emails.map((u) => String(u.email).toLowerCase()))
    expect(exact.size).toBeGreaterThan(lower.size) // at least one pair differs only by case
    expect(emails.length - exact.size).toBeGreaterThan(0) // and at least one exact copy
  })

  it('roster users have a username and no e-mail, and use the shared default hash', () => {
    const roster = asRows(fx, 'users').filter((u) => u.email === null)
    expect(roster).toHaveLength(planted.rosterNoEmail)
    expect(scanned.nulls['users.email']).toBe(planted.rosterNoEmail)
    for (const u of roster) {
      expect(typeof u.username).toBe('string')
      expect(u.password).toBe(DEFAULT_HASH)
    }
    expect(scanned.sharedDefaultHash).toBe(planted.sharedDefaultHash)
  })

  it('unknown enum values', () => {
    const count = (table: string, col: string, value: string) => asRows(fx, table).filter((r) => r[col] === value).length
    expect(planted.unknownEnums['users.role']).toEqual({ [UNKNOWN_ROLE]: count('users', 'role', UNKNOWN_ROLE) })
    expect(planted.unknownEnums['coin_transactions.type']).toEqual({ [UNKNOWN_COIN_TYPE]: count('coin_transactions', 'type', UNKNOWN_COIN_TYPE) })
    expect(planted.unknownEnums['practice_sessions.mode']).toEqual({ [UNKNOWN_MODE]: count('practice_sessions', 'mode', UNKNOWN_MODE) })
    expect(count('users', 'role', UNKNOWN_ROLE)).toBe(2 * B)
  })

  it('password hash classes: non-bcrypt, empty, null and plain text', () => {
    const odd = Object.fromEntries(Object.entries(scanned.passwordPrefixes).filter(([k]) => k !== '$2y$'))
    expect(odd).toEqual(planted.passwordPrefixes)
    expect(Object.keys(odd).sort()).toEqual(['$2b$', '$argon2id$', '(empty)', '(null)', '(other)'])
  })

  it('date-only edges: a stored UTC date that is the day before the Malaysia date', () => {
    expect(scanned.dateOnlyEdges).toEqual(planted.dateOnlyEdges)
    const exactMidnight = asRows(fx, 'mood_checkins').filter((r) => String(r.created_at).endsWith('T16:00:00Z'))
    expect(exactMidnight.length).toBe(B) // exactly 00:00 in Malaysia
  })

  it('cyclic references: pairs and self references in users.referred_by', () => {
    const users = asRows(fx, 'users')
    const parent = new Map(users.map((u) => [u.id as number, u.referred_by as number | undefined]))
    let pairs = 0
    let selfRefs = 0
    for (const [id, ref] of parent) {
      if (ref === id) selfRefs++
      else if (ref !== undefined && parent.get(ref) === id && id < ref) pairs++
    }
    expect({ pairs, selfReferences: selfRefs }).toEqual(planted.referralCycles)
  })

  it('secrets the loader must drop are present in the source rows', () => {
    const users = asRows(fx, 'users')
    expect(users.filter((u) => u.remember_token != null)).toHaveLength(planted.redactedSecrets['users.remember_token'] as number)
    expect(users.filter((u) => u.parent_invite_token != null)).toHaveLength(planted.redactedSecrets['users.parent_invite_token'] as number)
  })

  it('duplicate pivot rows', () => {
    const rows = asRows(fx, 'classroom_student').map((r) => `${r.classroom_id}|${r.student_id}`)
    expect(rows.length - new Set(rows).size).toBe(planted.duplicatePivotRows.classroom_student)
  })
})

describe('medium', () => {
  it('generates the medium size without error and scales the planted counts', () => {
    const fx = generateFixture('medium', 9)
    expect(asRows(fx, 'users')).toHaveLength(20000)
    expect(fx.anomalies.planted.orphans['question_attempts.question_id']).toBe(300)
    expect(fx.anomalies.scanned.orphans).toEqual(fx.anomalies.planted.orphans)
  }, 60_000)
})

describe('fixtures:generate', () => {
  it('writes into .migration-out, reuses a synthetic directory, and refuses a foreign one', () => {
    const out = work.out('fx')
    const log: string[] = []
    expect(runFixturesCli(['fixtures:generate', '--size', 'tiny', '--seed', '3', '--out', out], { out: (l) => log.push(l), err: (l) => log.push(l) })).toBe(FIXTURE_EXIT.ok)
    expect(log.join('\n')).toMatch(/Synthetic data only/)
    expect(readdirSync(out)).toContain('anomalies.json')
    expect(runFixturesCli(['fixtures:generate', '--size', 'tiny', '--seed', '4', '--out', out], { out: () => undefined, err: () => undefined })).toBe(FIXTURE_EXIT.ok)

    const foreign = work.out('foreign')
    mkdirSync(foreign)
    writeFileSync(join(foreign, 'precious.txt'), 'keep me')
    const errs: string[] = []
    expect(runFixturesCli(['fixtures:generate', '--size', 'tiny', '--out', foreign], { out: () => undefined, err: (l) => errs.push(l) })).toBe(FIXTURE_EXIT.failed)
    expect(readFileSync(join(foreign, 'precious.txt'), 'utf8')).toBe('keep me')
    expect(errs.join(' ')).toMatch(/not a synthetic fixture/)
  })

  it('refuses a location outside .migration-out and the committed fixtures tree, and bad flags', () => {
    const errs: string[] = []
    const outside = work.outside('fx')
    expect(runFixturesCli(['fixtures:generate', '--size', 'tiny', '--out', outside], { out: () => undefined, err: (l) => errs.push(l) })).toBe(FIXTURE_EXIT.failed)
    expect(existsSync(outside)).toBe(false)
    expect(errs.join(' ')).toMatch(/\.migration-out/)
    for (const bad of [['--size', 'big'], [], ['--size', 'tiny', '--seed', 'x'], ['--size', 'tiny', '--seed', '99999999999'], ['--size', 'tiny', '--nope', '1']]) {
      expect(runFixturesCli(['fixtures:generate', ...bad], { out: () => undefined, err: () => undefined })).toBe(FIXTURE_EXIT.usage)
    }
    rmSync(work.outside('fx'), { recursive: true, force: true })
  })
})
