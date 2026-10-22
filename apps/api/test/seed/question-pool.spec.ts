import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { questionPoolSeed, poolSpecs } from '../../prisma/seed/questions/pool'
import { POOL_LEVELS, POOL_PER_LEVEL, POOL_SUBJECTS, poolBank } from '../../prisma/seed/questions/pool-content'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * Consumer minimums the pool must clear at ONE subject and level (demo blocker, PR #88):
 * battle arena 10 (`BATTLE_RULES.arenaQuestions`), Jutawan 15 (4/4/4/3 over TP 1-4), practice session 20 (largest
 * count option). Per subject over both levels: SPM mock paper 1 30, Latih Tubi / Tracking A default set 40.
 */
const MIN_PER_LEVEL = 20
const MIN_SPM_PER_SUBJECT = 40
const JUTAWAN_LADDER: Record<number, number> = { 1: 4, 2: 4, 3: 4, 4: 3 }

describe('PoC question pool content (pure)', () => {
  it('defines at least POOL_PER_LEVEL items per subject and level, above the largest consumer minimum', () => {
    expect(POOL_PER_LEVEL).toBeGreaterThan(MIN_PER_LEVEL)
    expect(POOL_PER_LEVEL * POOL_LEVELS.length).toBeGreaterThanOrEqual(MIN_SPM_PER_SUBJECT)
    for (const s of POOL_SUBJECTS) for (const l of POOL_LEVELS) expect(poolBank(s, l).length, `${s} ${l}`).toBeGreaterThanOrEqual(POOL_PER_LEVEL)
  })

  it('every item has four distinct non-empty options, one key and a text unique within its subject and level', () => {
    const specs = poolSpecs()
    expect(specs).toHaveLength(POOL_SUBJECTS.length * POOL_LEVELS.length * POOL_PER_LEVEL)
    expect(new Set(specs.map((s) => s.ref)).size).toBe(specs.length)
    const texts = new Map<string, Set<string>>()
    for (const s of specs) {
      const part = s.part as { mode: string; options: { label: string; body: { ms: string } }[]; key: { kind: string; correct: string } }
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

  it('renders computed values with at most 2 decimal places', () => {
    for (const s of poolSpecs()) {
      const part = s.part as { options: { body: { ms: string } }[] }
      for (const o of part.options) expect(o.body.ms, s.ref).not.toMatch(/\d\.\d{3,}/)
    }
  })

  it("never offers 'pendek' as a wrong option for the antonym of 'tinggi'", () => {
    const s = poolSpecs().find((x) => x.text === "Apakah antonim bagi perkataan 'tinggi'?")
    const part = s?.part as { options: { body: { ms: string } }[] } | undefined
    expect(part?.options.map((o) => o.body.ms)).not.toContain('pendek')
  })

  it('spreads the key over A to D and the difficulty TP over 1 to 4 in each subject and level', () => {
    for (const s of POOL_SUBJECTS) {
      for (const l of POOL_LEVELS) {
        const rows = poolSpecs().filter((x) => x.subject === s && x.level === l)
        const keys = new Set(rows.map((r) => (r.part as { key: { correct: string } }).key.correct))
        expect(keys.size, `${s} ${l} keys`).toBe(4)
        for (const [tp, need] of Object.entries(JUTAWAN_LADDER)) {
          expect(rows.filter((r) => r.difficultyTp === Number(tp)).length, `${s} ${l} TP ${tp}`).toBeGreaterThanOrEqual(need)
        }
      }
    }
  })

  it('computed items carry the right key (spot checks)', () => {
    const find = (prefix: string) => {
      const s = poolSpecs().find((x) => x.text.startsWith(prefix))
      if (!s) throw new Error(`no item starting with ${prefix}`)
      const part = s.part as { options: { label: string; body: { ms: string } }[]; key: { correct: string } }
      return part.options.find((o) => o.label === part.key.correct)?.body.ms
    }
    expect(find('Tukarkan 12 kepada')).toBe('1100₂')
    expect(find('Diberi n(A) = 12, n(B) = 9')).toBe('17')
    expect(find('Hitung berat sebuah objek berjisim 5 kg')).toBe('50 N')
    expect(find('Cari bilangan cara untuk memilih 2 orang murid daripada 6')).toBe('15')
    expect(find("Apakah antonim bagi perkataan 'tinggi'")).toBe('rendah')
    expect(find('Pada tahun berapakah Malaysia dibentuk')).toBe('1963')
    expect(find('Berapakah bilangan rakaat solat fardu Maghrib')).toBe('3')
  })
})

describe('PoC question pool seed (database)', () => {
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

  it(`gives every pool subject at least ${MIN_PER_LEVEL} eligible MCQs at Tingkatan 4 and 5 (battle, Jutawan, practice)`, async () => {
    const rows = await eligible()
    for (const s of POOL_SUBJECTS) {
      for (const l of POOL_LEVELS) {
        const n = rows.find((r) => r.subject === s && r.level === l)?.n ?? 0
        expect(n, `${s} ${l}`).toBeGreaterThanOrEqual(POOL_PER_LEVEL)
      }
    }
  })

  it('writes exactly POOL_PER_LEVEL pool rows per subject and level, fully tagged, published, in the SPM pool', async () => {
    const rows = (await db.query(
      `select s.code as subject, l.code as level, count(*)::int as n,
              count(*) filter (where v.unit_node_id is not null and v.difficulty_tp between 1 and 4 and v.cognitive_level is not null)::int as tagged,
              count(*) filter (where exists (select 1 from question_version_sp_nodes sp where sp.question_version_id = v.id))::int as with_sp,
              count(*) filter (where exists (select 1 from question_tags t where t.question_id = q.id and t.kind = 'pool' and t.code = 'spm'))::int as spm,
              count(*) filter (where q.live_version_no = 1 and v.status = 'published' and q.is_active)::int as live
         from question_versions v
         join questions q on q.id = v.question_id
         join subjects s on s.id = v.subject_id
         join education_levels l on l.id = v.education_level_id
        where v.number_label like 'SEED-POOL-%'
        group by s.code, l.code`,
    )) as { subject: string; level: string; n: number; tagged: number; with_sp: number; spm: number; live: number }[]
    expect(rows).toHaveLength(POOL_SUBJECTS.length * POOL_LEVELS.length)
    for (const r of rows) {
      expect(r, `${r.subject} ${r.level}`).toMatchObject({ n: POOL_PER_LEVEL, tagged: POOL_PER_LEVEL, with_sp: POOL_PER_LEVEL, spm: POOL_PER_LEVEL, live: POOL_PER_LEVEL })
    }
  })

  it(`gives every pool subject at least ${MIN_SPM_PER_SUBJECT} SPM-pool MCQs (SPM mock, Latih Tubi)`, async () => {
    const rows = (await db.query(
      `select s.code as subject, count(*)::int as n
         from questions q
         join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
         join subjects s on s.id = v.subject_id
        where q.is_active and v.status = 'published' and v.type = 'mcq'
          and exists (select 1 from question_tags t where t.question_id = q.id and t.kind = 'pool' and t.code = 'spm')
        group by s.code`,
    )) as { subject: string; n: number }[]
    for (const s of POOL_SUBJECTS) expect(rows.find((r) => r.subject === s)?.n ?? 0, s).toBeGreaterThanOrEqual(MIN_SPM_PER_SUBJECT)
  })

  it('stores each part as one MCQ with four options and an option key matching an option label', async () => {
    const bad = await db.query(
      `select v.number_label from question_versions v
         join question_parts p on p.question_version_id = v.id
        where v.number_label like 'SEED-POOL-%'
          and (p.mode <> 'mcq'
               or (select count(*) from part_options o where o.part_id = p.id) <> 4
               or not exists (select 1 from answer_keys k join part_options o on o.part_id = p.id
                               where k.part_id = p.id and k.kind = 'option' and k.content->>'correct' = o.label))`,
    )
    expect(bad).toEqual([])
  })

  it('is idempotent: a second run inserts nothing', async () => {
    const count = async () => Number(((await db.query(`select count(*)::int as n from questions`)) as { n: number }[])[0]?.n)
    const before = await count()
    await runSeeds([questionPoolSeed], { prisma: db.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
    expect(await count()).toBe(before)
  })

  it('runs before the spm seeds, which build their Tracking A sets from the SPM pool once per subject', () => {
    const names = seedModules.map((m) => m.name)
    expect(names.indexOf('questions-pool')).toBeGreaterThan(-1)
    expect(names.indexOf('questions-pool')).toBeLessThan(names.indexOf('spm'))
    expect(names.indexOf('questions-pool')).toBeLessThan(names.indexOf('spm-subject-configs'))
  })

  it('runs in the poc profile only and is refused in production', async () => {
    expect(questionPoolSeed.profiles).toEqual(['poc'])
    expect(questionPoolSeed.kind).toBe('demo')
    expect(await runSeeds([questionPoolSeed], { prisma: db.prisma, profile: 'other', env: { NODE_ENV: 'test' } })).toEqual([])
    expect(await runSeeds([questionPoolSeed], { prisma: db.prisma, profile: 'poc', env: { NODE_ENV: 'production' } })).toEqual([])
    const before = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      await expect(questionPoolSeed.run({ profile: 'poc', prisma: db.prisma } as never)).rejects.toThrow(/Refusing to seed demo data/)
    } finally {
      process.env.NODE_ENV = before
    }
  })
})
