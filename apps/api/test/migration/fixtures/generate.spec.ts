import { createHash } from 'node:crypto'
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
    const offenders: string[] = []
    const allowed = { allowedEmailDomains: [FICTITIOUS_DOMAIN] }
    for (const spec of TABLES) {
      for (const row of asRows(fx, spec.name)) {
        for (const value of Object.values(row)) {
          for (const s of strings(value)) {
            checked++
            if (DENY.test(s) || patternKinds(s, allowed).length > 0) offenders.push(`${spec.name}: ${s}`)
          }
        }
      }
    }
    expect(offenders.slice(0, 5)).toEqual([]) // one aggregated assertion for the whole fixture
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

// ---------------------------------------------------------------------------------------------------------
const sumsOf = (text: string): [hash: string, name: string][] =>
  text.split('\n').filter(Boolean).map((l) => {
    const m = /^([0-9a-f]{64})  (\S.*)$/.exec(l)
    expect(m, `not in sha256sum format: ${l}`).not.toBeNull()
    return [(m as RegExpExecArray)[1] as string, (m as RegExpExecArray)[2] as string]
  })
const sha = (content: string | Buffer): string => createHash('sha256').update(content).digest('hex')

describe('SHA256SUMS (rehearsal-db.sh load-dump checks it)', () => {
  const files = fixtureFiles(generateFixture('tiny', 1))

  it('is in sha256sum format, bytewise sorted, lists every other file once, and each hash matches the content', () => {
    const text = files.get('SHA256SUMS') as string
    expect(text.endsWith('\n')).toBe(true)
    expect(text).not.toMatch(/\r/)
    const entries = sumsOf(text)
    const names = entries.map(([, n]) => n)
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    expect(names).toEqual([...files.keys()].filter((k) => k !== 'SHA256SUMS')) // fixtureFiles returns sorted keys; SHA256SUMS lists all else
    expect(names).toContain('manifest.json')
    expect(names).toContain('anomalies.json')
    expect(names).toContain('users.ndjson')
    for (const [hash, name] of entries) expect(hash === sha(files.get(name) as string), name).toBe(true)
  })

  it('is part of the file set and differs for different data', () => {
    expect(files.has('SHA256SUMS')).toBe(true)
    const other = fixtureFiles(generateFixture('tiny', 2))
    expect(other.get('SHA256SUMS')).not.toBe(files.get('SHA256SUMS'))
  })

  it('the files written to a directory pass a real sha256sum check', () => {
    const out = work.out('sums')
    writeFixture('tiny', 1, out)
    const entries = sumsOf(readFileSync(join(out, 'SHA256SUMS'), 'utf8'))
    expect(entries.length).toBe(readdirSync(out).length - 1)
    for (const [hash, name] of entries) expect(hash === sha(readFileSync(join(out, name))), name).toBe(true)
  })
})

describe('observed value sets (docs/architecture/v2-data-migration.md 4.4, M14 8.1/8.3)', () => {
  const distinct = (fx: ReturnType<typeof generateFixture>, t: string, col: string): Set<unknown> => new Set(asRows(fx, t).map((r) => r[col]))

  describe.each(['tiny', 'small'] as const)('%s', (size) => {
    const fx = generateFixture(size, 7)

    it('practice session modes are the five observed ones (plus the planted unknown) and all five occur', () => {
      const seen = distinct(fx, 'practice_sessions', 'mode')
      seen.delete(UNKNOWN_MODE)
      expect([...seen].sort()).toEqual(['battle', 'chapter', 'latih_tubi', 'pksk', 'spm'])
    })

    it('coin ledger rows use only the M14 (type, source, sign) combinations, with spends and conversions negative', () => {
      const allowed = new Set([
        'earn|quiz_spm|1', 'earn|daily_login|1', 'convert|token_conversion|-1', 'earn|spm|1', 'earn|daily_challenge|1',
        'bonus|streak_bonus|1', 'earn|mystery_box|1', 'spend|reward_claim|-1', 'spend|hadiah_redeem|-1',
      ])
      const seen = new Set<string>()
      for (const c of asRows(fx, 'coin_transactions')) {
        if (c.type === UNKNOWN_COIN_TYPE) continue
        const key = `${c.type}|${c.source}|${Math.sign(c.amount as number)}`
        expect(allowed.has(key), key).toBe(true)
        expect(c.amount).not.toBe(0)
        seen.add(key)
      }
      expect([...seen].sort()).toEqual([...allowed].sort())
      const negatives = asRows(fx, 'coin_transactions').filter((c) => (c.amount as number) < 0)
      expect(negatives.length).toBeGreaterThan(0)
      for (const c of negatives) expect(['spend', 'convert', UNKNOWN_COIN_TYPE]).toContain(c.type)
      // The M14 ledger sources, so the ETL's source map and its rejects are both exercised.
      expect([...distinct(fx, 'coin_transactions', 'source')].sort()).toEqual(['daily_challenge', 'daily_login', 'hadiah_redeem', 'mystery_box', 'quiz_spm', 'reward_claim', 'spm', 'streak_bonus', 'token_conversion'])
    })

    it('challenge and banner types are the observed sets', () => {
      expect([...distinct(fx, 'challenges', 'challenge_type')].sort()).toEqual(['accuracy', 'quiz_count', 'streak', 'time_spent', 'topic_variety'])
      expect([...distinct(fx, 'banners', 'type')].sort()).toEqual(['announcement', 'hero', 'promo'])
    })

    it('education levels are "Darjah N" / "Tingkatan N" with an accepted stage each, and the grade is derivable', () => {
      const levels = asRows(fx, 'education_levels')
      expect(levels.map((l) => [l.name_bm, l.stage])).toEqual([
        ['Darjah 1', 'primary'], ['Darjah 6', 'primary'], ['Tingkatan 1', 'lower_secondary'], ['Tingkatan 4', 'upper_secondary'],
      ])
      expect(levels.map((l) => l.name_en)).toEqual(['Year 1', 'Year 6', 'Form 1', 'Form 4'])
      for (const l of levels) expect(String(l.name_bm)).toMatch(/^(Darjah [1-6]|Tingkatan [1-5])$/)
      expect(new Set(levels.map((l) => l.stage))).toEqual(new Set(['primary', 'lower_secondary', 'upper_secondary']))
    })
  })
})

describe.each(['tiny', 'small'] as const)('capped and single planted cases (%s)', (size) => {
  const fx = generateFixture(size, 5)
  const { planted } = fx.anomalies

  it('exactly one feedback score is outside 1 to 5 (it holds 9), and it is recorded as planted', () => {
    expect(planted.outOfRange['feedback.score']).toBe(1)
    const feedback = asRows(fx, 'feedback')
    const outside = feedback.filter((r) => (r.score as number) < 1 || (r.score as number) > 5)
    expect(outside).toHaveLength(1)
    expect(outside[0]?.score).toBe(9)
    expect(feedback[feedback.length - 1]?.score).toBe(9)
    for (const r of feedback.filter((x) => x !== outside[0])) expect([1, 2, 3, 4, 5]).toContain(r.score)
  })

  it('orphan topics are capped at 2 whatever the size (curriculum is fixed at 54 topics)', () => {
    const expected = size === 'tiny' ? 1 : 2 // tiny: round(1 / 2) = 1; small: min(2, 5)
    expect(planted.orphans['topics.chapter_id']).toBe(expected)
    const chapterIds = new Set(asRows(fx, 'chapters').map((c) => c.id))
    const orphanTopics = asRows(fx, 'topics').filter((t) => !chapterIds.has(t.chapter_id))
    expect(orphanTopics).toHaveLength(expected)
    expect(orphanTopics.length).toBeLessThanOrEqual(2)
    expect(asRows(fx, 'topics')).toHaveLength(54)
  })
})

describe('fixtures:generate replaces a stale SHA256SUMS', () => {
  it('a re-run over a synthetic directory with a bogus SHA256SUMS writes a fresh, correct one', () => {
    const out = work.out('stale-sums')
    const quiet = { out: () => undefined, err: () => undefined }
    expect(runFixturesCli(['fixtures:generate', '--size', 'tiny', '--seed', '3', '--out', out], quiet)).toBe(FIXTURE_EXIT.ok)
    const bogus = `${'0'.repeat(64)}  manifest.json\n`
    writeFileSync(join(out, 'SHA256SUMS'), bogus)
    const errs: string[] = []
    expect(runFixturesCli(['fixtures:generate', '--size', 'tiny', '--seed', '4', '--out', out], { out: () => undefined, err: (l) => errs.push(l) })).toBe(FIXTURE_EXIT.ok)
    expect(errs).toEqual([])
    const text = readFileSync(join(out, 'SHA256SUMS'), 'utf8')
    expect(text).not.toBe(bogus)
    expect(text).toBe(fixtureFiles(generateFixture('tiny', 4)).get('SHA256SUMS'))
    for (const [hash, name] of sumsOf(text)) expect(hash === sha(readFileSync(join(out, name))), name).toBe(true)
  })

  it('writeFixture does the same, and files the tool does not own are left alone', () => {
    const out = work.out('stale-sums-2')
    writeFixture('tiny', 1, out)
    writeFileSync(join(out, 'SHA256SUMS'), 'stale\n')
    writeFileSync(join(out, 'notes.txt'), 'keep me')
    writeFixture('tiny', 1, out)
    expect(readFileSync(join(out, 'SHA256SUMS'), 'utf8')).toBe(fixtureFiles(generateFixture('tiny', 1)).get('SHA256SUMS'))
    expect(readFileSync(join(out, 'notes.txt'), 'utf8')).toBe('keep me')
  })
})

// Slow (20,000 users); run with PP_FIXTURE_MEDIUM=1.
describe.skipIf(!process.env.PP_FIXTURE_MEDIUM)('medium', () => {
  it('generates the medium size without error and scales the planted counts', () => {
    const fx = generateFixture('medium', 9)
    expect(asRows(fx, 'users')).toHaveLength(20000)
    expect(fx.anomalies.planted.orphans['question_attempts.question_id']).toBe(300)
    expect(fx.anomalies.planted.orphans['topics.chapter_id']).toBe(2)
    expect(fx.anomalies.planted.outOfRange['feedback.score']).toBe(1)
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
