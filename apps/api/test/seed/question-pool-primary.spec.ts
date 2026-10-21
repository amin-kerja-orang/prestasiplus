import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { questionPoolPrimarySeed, primarySpecs } from '../../prisma/seed/questions/pool-primary'
import { PRIMARY_LEVELS, PRIMARY_PER_LEVEL, PRIMARY_SUBJECTS, primaryBank } from '../../prisma/seed/questions/pool-content-primary'
import { SOLO_INFO, SUSUN_MAX_ANSWER } from '../../src/modules/games/solo/play/solo.rules'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * Consumer minimums at Darjah 1 to 4. Practice "random": count up to 20 per subject and level. Solo games sample by LEVEL
 * over all subjects (Betul atau Salah 40, Cabaran Kilat and Tembak Jawapan 30 four-option, Susun Jawapan 20 with a correct
 * option of at most 20 characters, Kad Memori 6). Jutawan: 15 per subject and level with the 4/4/4/3 ladder.
 */
const PRACTICE_MAX = 20
const JUTAWAN_LADDER: Record<number, number> = { 1: 4, 2: 4, 3: 4, 4: 3 }

type PartShape = { mode: string; options: { label: string; body: { ms: string } }[]; key: { kind: string; correct: string } }
const keyText = (part: PartShape): string => part.options.find((o) => o.label === part.key.correct)?.body.ms ?? ''

describe('PoC primary question pool content (pure)', () => {
  it('defines at least PRIMARY_PER_LEVEL items per subject and level, above the practice maximum', () => {
    expect(PRIMARY_PER_LEVEL).toBeGreaterThan(PRACTICE_MAX)
    for (const s of PRIMARY_SUBJECTS) for (const l of PRIMARY_LEVELS) expect(primaryBank(s, l).length, `${s} ${l}`).toBeGreaterThanOrEqual(PRIMARY_PER_LEVEL)
  })

  it('every item has four distinct non-empty options, one key and a text unique within its subject and level', () => {
    const specs = primarySpecs()
    expect(specs).toHaveLength(PRIMARY_SUBJECTS.length * PRIMARY_LEVELS.length * PRIMARY_PER_LEVEL)
    expect(new Set(specs.map((s) => s.ref)).size).toBe(specs.length)
    expect(specs.every((s) => /^SEED-PRIM-(BM|BI|MATH|SCI)-D[1-4]-\d{2}$/.test(s.ref))).toBe(true)
    const texts = new Map<string, Set<string>>()
    for (const s of specs) {
      const part = s.part as PartShape
      expect(part.mode).toBe('mcq')
      expect(part.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
      const bodies = part.options.map((o) => o.body.ms.trim())
      expect(bodies.every((b) => b.length > 0), s.ref).toBe(true)
      expect(new Set(bodies).size, s.ref).toBe(4)
      expect(['A', 'B', 'C', 'D']).toContain(part.key.correct)
      const k = `${s.subject}|${s.level}`
      const seen = texts.get(k) ?? new Set<string>()
      expect(seen.has(s.text), `${s.ref} repeats a text`).toBe(false)
      seen.add(s.text)
      texts.set(k, seen)
    }
  })

  it('renders computed values with at most 2 decimal places and never a negative whole-number option', () => {
    for (const s of primarySpecs()) {
      for (const o of (s.part as PartShape).options) {
        expect(o.body.ms, s.ref).not.toMatch(/\d\.\d{3,}/)
        if (s.subject === 'MATH') expect(o.body.ms, s.ref).not.toMatch(/^−/)
      }
    }
  })

  it('spreads the key over A to D and the difficulty TP over 1 to 4 (Jutawan ladder 4/4/4/3) in each subject and level', () => {
    for (const s of PRIMARY_SUBJECTS) {
      for (const l of PRIMARY_LEVELS) {
        const rows = primarySpecs().filter((x) => x.subject === s && x.level === l)
        expect(new Set(rows.map((r) => (r.part as PartShape).key.correct)).size, `${s} ${l} keys`).toBe(4)
        for (const tp of [1, 2, 3, 4]) expect(rows.filter((r) => r.difficultyTp === tp).length, `${s} ${l} TP ${tp}`).toBe(PRIMARY_PER_LEVEL / 4)
        for (const [tp, need] of Object.entries(JUTAWAN_LADDER)) expect(rows.filter((r) => r.difficultyTp === Number(tp)).length).toBeGreaterThanOrEqual(need)
      }
    }
  })

  it('gives every level enough items for the solo games (all four-option MCQs, with margin)', () => {
    for (const l of PRIMARY_LEVELS) {
      const rows = primarySpecs().filter((x) => x.level === l)
      const short = rows.filter((r) => {
        const t = keyText(r.part as PartShape).trim()
        return t !== '' && t.length <= SUSUN_MAX_ANSWER
      })
      expect(rows.length, `${l} total`).toBeGreaterThanOrEqual(SOLO_INFO['betul-salah'].items + 20)
      expect(rows.length, `${l} four-option`).toBeGreaterThanOrEqual(SOLO_INFO['cabaran-kilat'].items + 20)
      expect(short.length, `${l} short answers`).toBeGreaterThanOrEqual(SOLO_INFO['susun-jawapan'].items + 20)
    }
  })

  it('computed items carry the right key (spot checks)', () => {
    const find = (level: string, prefix: string) => {
      const s = primarySpecs().find((x) => x.level === level && x.text.startsWith(prefix))
      if (!s) throw new Error(`no item starting with ${prefix}`)
      return keyText(s.part as PartShape)
    }
    expect(find('D1', 'Berapakah 7 + 5?')).toBe('12')
    expect(find('D2', 'Berapakah 5 × 7?')).toBe('35')
    expect(find('D3', 'Berapakah 56 ÷ 7?')).toBe('8')
    expect(find('D4', 'Berapakah 5000 − 2376?')).toBe('2624')
    expect(find('D4', 'Sebuah segi empat tepat berukuran panjang 8 cm dan lebar 5 cm. Cari perimeter')).toBe('26 cm')
    expect(find('D1', "Apakah huruf pertama bagi perkataan 'gajah'")).toBe('G')
    expect(find('D3', "What is the plural of 'mouse'")).toBe('mice')
    expect(find('D4', 'Berdasarkan makanannya, singa')).toBe('karnivor')
  })
})

describe('PoC primary question pool seed (database)', () => {
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds(seedModules, { prisma: db.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
  }, 240_000)
  afterAll(async () => {
    await db.drop()
  })

  /** Live-published, active MCQs (what `QuestionsRepository.eligibleIds({ type: 'mcq' })` serves) per subject and level. */
  const eligible = () =>
    db.query(
      `select s.code as subject, l.code as level, count(*)::int as n
         from questions q
         join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
         join subjects s on s.id = v.subject_id
         join education_levels l on l.id = v.education_level_id
        where q.is_active and v.status = 'published' and v.type = 'mcq'
        group by s.code, l.code`,
    ) as Promise<{ subject: string; level: string; n: number }[]>

  it('gives each primary subject at least 24 eligible MCQs at Darjah 1 to 4 (practice random up to 20, Jutawan 15)', async () => {
    const rows = await eligible()
    for (const s of PRIMARY_SUBJECTS) {
      for (const l of PRIMARY_LEVELS) expect(rows.find((r) => r.subject === s && r.level === l)?.n ?? 0, `${s} ${l}`).toBeGreaterThanOrEqual(PRIMARY_PER_LEVEL)
    }
  })

  it('gives every level enough eligible MCQs across subjects for the solo games and Kad Memori', async () => {
    const rows = await eligible()
    for (const l of PRIMARY_LEVELS) {
      const total = rows.filter((r) => r.level === l).reduce((s, r) => s + r.n, 0)
      expect(total, l).toBeGreaterThanOrEqual(SOLO_INFO['betul-salah'].items)
    }
  })

  it('writes exactly PRIMARY_PER_LEVEL rows per subject and level: published, live version 1, TP and cognitive level set, not in the SPM pool', async () => {
    const rows = (await db.query(
      `select s.code as subject, l.code as level, count(*)::int as n,
              count(*) filter (where v.difficulty_tp between 1 and 4 and v.cognitive_level is not null)::int as tagged,
              count(*) filter (where v.form_origin = 't1_t3' and v.version_no = 1)::int as origin,
              count(*) filter (where exists (select 1 from question_tags t where t.question_id = q.id))::int as tags,
              count(*) filter (where q.live_version_no = 1 and v.status = 'published' and q.is_active)::int as live
         from question_versions v
         join questions q on q.id = v.question_id
         join subjects s on s.id = v.subject_id
         join education_levels l on l.id = v.education_level_id
        where v.number_label like 'SEED-PRIM-%'
        group by s.code, l.code`,
    )) as { subject: string; level: string; n: number; tagged: number; origin: number; tags: number; live: number }[]
    expect(rows).toHaveLength(PRIMARY_SUBJECTS.length * PRIMARY_LEVELS.length)
    for (const r of rows) {
      expect(r, `${r.subject} ${r.level}`).toMatchObject({ n: PRIMARY_PER_LEVEL, tagged: PRIMARY_PER_LEVEL, origin: PRIMARY_PER_LEVEL, tags: 0, live: PRIMARY_PER_LEVEL })
    }
    const spm = (await db.query(
      `select count(*)::int as n from question_tags t join question_versions v on v.question_id = t.question_id
        where t.kind = 'pool' and t.code = 'spm' and v.education_level_id in (select id from education_levels where code like 'D%')`,
    )) as { n: number }[]
    expect(spm[0]?.n).toBe(0)
  })

  it('stores each part as one MCQ with four options and an option key matching an option label', async () => {
    const bad = await db.query(
      `select v.number_label from question_versions v
         join question_parts p on p.question_version_id = v.id
        where v.number_label like 'SEED-PRIM-%'
          and (p.mode <> 'mcq'
               or (select count(*) from part_options o where o.part_id = p.id) <> 4
               or not exists (select 1 from answer_keys k join part_options o on o.part_id = p.id
                               where k.part_id = p.id and k.kind = 'option' and k.content->>'correct' = o.label))`,
    )
    expect(bad).toEqual([])
    const parts = (await db.query(
      `select count(*)::int as n from question_versions v join question_parts p on p.question_version_id = v.id where v.number_label like 'SEED-PRIM-%'`,
    )) as { n: number }[]
    expect(parts[0]?.n).toBe(PRIMARY_SUBJECTS.length * PRIMARY_LEVELS.length * PRIMARY_PER_LEVEL)
  })

  it('leaves the base pool (Tingkatan 4 and 5) untouched: its prefix and count are its own', async () => {
    const base = (await db.query(`select count(*)::int as n from question_versions where number_label like 'SEED-POOL-%'`)) as { n: number }[]
    expect(base[0]?.n).toBe(480)
  })

  it('is idempotent: a second run inserts nothing', async () => {
    const count = async () => Number(((await db.query(`select count(*)::int as n from questions`)) as { n: number }[])[0]?.n)
    const before = await count()
    await runSeeds([questionPoolPrimarySeed], { prisma: db.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
    expect(await count()).toBe(before)
  })

  it('runs right after the base pool and before the spm seeds', () => {
    const names = seedModules.map((m) => m.name)
    expect(names.indexOf('questions-pool-primary')).toBe(names.indexOf('questions-pool') + 1)
    expect(names.indexOf('questions-pool-primary')).toBeLessThan(names.indexOf('spm-subject-configs'))
    expect(names.indexOf('questions-pool-primary')).toBeLessThan(names.indexOf('spm'))
  })

  it('runs in the poc profile only and is refused in production', async () => {
    expect(questionPoolPrimarySeed.profiles).toEqual(['poc'])
    expect(questionPoolPrimarySeed.kind).toBe('demo')
    expect(await runSeeds([questionPoolPrimarySeed], { prisma: db.prisma, profile: 'other', env: { NODE_ENV: 'test' } })).toEqual([])
    expect(await runSeeds([questionPoolPrimarySeed], { prisma: db.prisma, profile: 'poc', env: { NODE_ENV: 'production' } })).toEqual([])
    const before = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      await expect(questionPoolPrimarySeed.run({ profile: 'poc', prisma: db.prisma } as never)).rejects.toThrow(/Refusing to seed demo data/)
    } finally {
      process.env.NODE_ENV = before
    }
  })
})
