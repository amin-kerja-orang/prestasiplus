import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { SessionSchema } from '@pp/contract'
import type request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { questionPoolSeed, poolSpecs } from '../../prisma/seed/questions/pool'
import { POOL_PER_LEVEL } from '../../prisma/seed/questions/pool-content'
import { PRIMARY_LEVELS, PRIMARY_PER_LEVEL, PRIMARY_SUBJECTS, primaryBank } from '../../prisma/seed/questions/pool-content-primary'
import { featureModules } from '../../src/modules'
import { SOLO_INFO, SUSUN_MAX_ANSWER } from '../../src/modules/games/solo/play/solo.rules'
import { COUNT_OPTIONS, OFFERED_LEVEL_CODES } from '../../src/modules/practice/rules'
import { GAMES_THROTTLES_LIFTED } from '../games/helpers'
import { bootSchoolAdminApp, DEMO_PASSWORD, type SchoolAdminTestApp } from '../school-admin/helpers'

/**
 * AZ-02 (demo 23 Oct): the PoC pool at Darjah 1 to 4. Practice `random` offers D1 to D4 only (BR-11), Jutawan Ilmu and
 * the four question games draw at the pupil's level, Kad Memori draws over D1 to D4. Before AZ-02 the bank had no
 * question below Tingkatan 4, so all of them came back empty (UAT J-01).
 */
const PRACTICE_MAX = Math.max(...COUNT_OPTIONS) // 20
const JUTAWAN_LADDER: Record<number, number> = { 1: 4, 2: 4, 3: 4, 4: 3 }
const SUBJECT_LEVELS = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../prisma/seed/curriculum-data/subject-levels.json', import.meta.url)), 'utf8'),
) as [string, string][]

type Part = { mode: string; options: { label: string; body: { ms: string } }[]; key: { correct: string } }
const keyText = (p: Part): string => p.options.find((o) => o.label === p.key.correct)?.body.ms ?? ''
const primarySpecs = () => poolSpecs().filter((s) => !s.tingkatan)

describe('PoC question pool at Darjah 1 to 4 (pure)', () => {
  it('is not offered by practice random any more, for pool subjects the curriculum links to every one of them', () => {
    // Secondary-only (2026-10-29): practice random offers T4/T5, so the Darjah pool is not offered.
    for (const l of PRIMARY_LEVELS) expect(OFFERED_LEVEL_CODES).not.toContain(l)
    for (const s of PRIMARY_SUBJECTS) for (const l of PRIMARY_LEVELS) expect(SUBJECT_LEVELS, `${s} ${l}`).toContainEqual([s, l])
  })

  it(`defines at least ${PRIMARY_PER_LEVEL} items per subject and level, above a practice session of ${PRACTICE_MAX}`, () => {
    expect(PRIMARY_PER_LEVEL).toBeGreaterThan(PRACTICE_MAX)
    for (const s of PRIMARY_SUBJECTS) for (const l of PRIMARY_LEVELS) expect(primaryBank(s, l).length, `${s} ${l}`).toBeGreaterThanOrEqual(PRIMARY_PER_LEVEL)
    expect(primarySpecs()).toHaveLength(PRIMARY_SUBJECTS.length * PRIMARY_LEVELS.length * PRIMARY_PER_LEVEL)
  })

  it('every item is one MCQ with four distinct non-empty options, a key and a text unique within its subject and level', () => {
    const texts = new Map<string, Set<string>>()
    const refs = new Set(poolSpecs().map((s) => s.ref))
    expect(refs.size).toBe(poolSpecs().length)
    for (const s of primarySpecs()) {
      expect(s.ref).toMatch(/^SEED-POOL-[A-Z]+-D[1-4]-\d{2}$/)
      const part = s.part as Part
      expect(part.mode).toBe('mcq')
      expect(part.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
      const bodies = part.options.map((o) => o.body.ms.trim())
      expect(bodies.every((b) => b.length > 0), s.ref).toBe(true)
      expect(new Set(bodies).size, s.ref).toBe(4)
      expect(keyText(part), s.ref).not.toBe('')
      const k = `${s.subject}|${s.level}`
      const seen = texts.get(k) ?? new Set<string>()
      expect(seen.has(s.text), `${s.ref} repeats a text`).toBe(false)
      seen.add(s.text)
      texts.set(k, seen)
    }
  })

  it('spreads the key over A to D and has the Jutawan TP ladder in each subject and level', () => {
    for (const s of PRIMARY_SUBJECTS) {
      for (const l of PRIMARY_LEVELS) {
        const rows = primarySpecs().filter((x) => x.subject === s && x.level === l)
        expect(new Set(rows.map((r) => (r.part as Part).key.correct)).size, `${s} ${l} keys`).toBe(4)
        for (const [tp, need] of Object.entries(JUTAWAN_LADDER)) {
          expect(rows.filter((r) => r.difficultyTp === Number(tp)).length, `${s} ${l} TP ${tp}`).toBeGreaterThanOrEqual(need)
        }
      }
    }
  })

  it('has enough items per level for the largest solo draws, Susun Jawapan short keys included whatever the sample', () => {
    const susun = SOLO_INFO['susun-jawapan']
    for (const l of PRIMARY_LEVELS) {
      const rows = primarySpecs().filter((x) => x.level === l)
      expect(rows.length, l).toBeGreaterThanOrEqual(SOLO_INFO['betul-salah'].items)
      // Susun samples items x oversample questions, then keeps keys of at most 20 characters: enough short keys must be
      // left even when the sample leaves out every other question of the level.
      const short = rows.filter((r) => keyText(r.part as Part).trim().length <= SUSUN_MAX_ANSWER).length
      const missed = Math.max(0, rows.length - susun.items * susun.oversample)
      expect(short - missed, `${l} short keys`).toBeGreaterThanOrEqual(susun.items)
    }
  })

  it('has no distractor that is also a correct answer (banned key -> distractor pairs)', () => {
    // Each entry: every question containing `ask` must have key `key` and must never offer a `banned` option.
    const BANNED: { ask: string; key: string; banned: string[]; why: string }[] = [
      { ask: "penjodoh bilangan yang sesuai bagi 'pokok'", key: 'sepohon', banned: ['sebatang'], why: 'sebatang pokok is also correct' },
      { ask: 'Besi ialah bahan', key: 'konduktor elektrik', banned: ['bahan magnet'], why: 'iron is magnetic' },
      { ask: 'Kayu kering ialah bahan', key: 'penebat elektrik', banned: ['bahan api'], why: 'dry wood is a fuel' },
      { ask: 'bergerak dengan cara berenang', key: 'ikan', banned: ['katak'], why: 'frogs swim' },
      { ask: 'Perbuatan menjaga adik yang sakit menunjukkan nilai', key: 'kasih sayang', banned: ['baik hati'], why: 'also fits baik hati' },
      { ask: 'bagi aktiviti gosokan', key: 'permukaan bertekstur', banned: ['krayon', 'krayon minyak'], why: 'gosokan shares crayon with resis' },
      { ask: 'bagi aktiviti resis', key: 'krayon minyak', banned: ['krayon'], why: 'gosokan must not be the crayon activity' },
      { ask: 'bagi aktiviti gosokan', key: 'permukaan bertekstur', banned: ['pensel', 'blok cetakan'], why: 'gosokan is done with pensel; a print block is textured' },
      { ask: 'bagi aktiviti lukisan', key: 'pensel', banned: ['krayon minyak', 'kertas'], why: 'drawing also uses crayons and paper' },
      { ask: 'menggunakan krayon minyak dan cat air', key: 'resis', banned: ['gosokan', 'lukisan'], why: 'both also use crayons' },
      { ask: 'menggunakan pensel untuk melakar', key: 'lukisan', banned: ['gosokan'], why: 'gosokan also uses pensel' },
      { ask: 'Bagaimanakah ular bergerak', key: 'menjalar', banned: ['merayap'], why: 'merayap also fits a snake' },
      { ask: 'Apakah fungsi batang bagi tumbuhan', key: 'mengangkut air ke daun', banned: ['menyokong tumbuhan'], why: 'roots also anchor the plant' },
    ]
    for (const b of BANNED) {
      const rows = primarySpecs().filter((x) => x.text.includes(b.ask))
      expect(rows.length, `no item for "${b.ask}"`).toBeGreaterThan(0)
      for (const r of rows) {
        const part = r.part as Part
        expect(keyText(part), `${r.ref} key`).toBe(b.key)
        const options = part.options.map((o) => o.body.ms)
        for (const x of b.banned) expect(options, `${r.ref}: ${x} (${b.why})`).not.toContain(x)
      }
    }
  })

  it('computed items carry the right key (spot checks)', () => {
    const find = (prefix: string) => {
      const s = primarySpecs().find((x) => x.text.startsWith(prefix))
      if (!s) throw new Error(`no item starting with ${prefix}`)
      return keyText(s.part as Part)
    }
    expect(find('Berapakah 2 + 3?')).toBe('5')
    expect(find('Berapakah 48 − 23?')).toBe('25')
    expect(find('Berapakah 7 × 9?')).toBe('63')
    expect(find('Berapakah satu perempat daripada 20?')).toBe('5')
    expect(find('3 jam bersamaan')).toBe('180 minit')
    expect(find('Sebuah segi empat sama mempunyai sisi 7 cm')).toBe('28 cm')
    expect(find("Apakah antonim bagi perkataan 'besar'")).toBe('kecil')
    expect(find('Berapakah bilangan rakaat solat fardu Maghrib')).toBe('3')
    expect(find('Planet ketiga dari Matahari')).toBe('Bumi')
  })
})

describe('PoC question pool at Darjah 1 to 4 (database and API)', () => {
  let t: SchoolAdminTestApp
  let levelId: Map<string, string>

  beforeAll(async () => {
    t = await bootSchoolAdminApp({
      modules: featureModules,
      env: { THROTTLE_PRACTICE_WRITE_PER_MINUTE: '100000', THROTTLE_LOGIN_PER_MINUTE: '1000', ...GAMES_THROTTLES_LIFTED },
    })
    await runSeeds(seedModules, { prisma: t.db.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
    levelId = new Map((await t.db.query<{ code: string; id: string }>(`select code, id::text as id from education_levels`)).map((r) => [r.code, r.id]))
  }, 240_000)
  afterAll(async () => {
    await t.close()
  })

  const poolRows = () =>
    t.db.query<{ subject: string; level: string; n: number; live: number; tp: number; untagged: number; spm: number; origin: number }>(
      `select s.code as subject, l.code as level, count(*)::int as n,
              count(*) filter (where q.live_version_no = 1 and v.status = 'approved' and q.is_active and v.type = 'mcq')::int as live,
              count(*) filter (where v.difficulty_tp between 1 and 4 and v.cognitive_level is not null)::int as tp,
              count(*) filter (where v.unit_node_id is null
                and not exists (select 1 from question_version_sp_nodes sp where sp.question_version_id = v.id))::int as untagged,
              count(*) filter (where exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pool' and g.code = 'spm'))::int as spm,
              count(*) filter (where v.form_origin = case l.code when 'T5' then 't5' when 'T4' then 't4' else 't1_t3' end)::int as origin
         from question_versions v
         join questions q on q.id = v.question_id
         join subjects s on s.id = v.subject_id
         join education_levels l on l.id = v.education_level_id
        where v.number_label like 'SEED-POOL-%'
        group by s.code, l.code`,
    )

  it(`writes ${PRIMARY_PER_LEVEL} published, live MCQs per subject at each of D1 to D4, untagged, outside the SPM pool, form origin t1_t3`, async () => {
    const rows = (await poolRows()).filter((r) => r.level.startsWith('D'))
    expect(rows).toHaveLength(PRIMARY_SUBJECTS.length * PRIMARY_LEVELS.length)
    for (const r of rows) {
      expect(PRIMARY_SUBJECTS as readonly string[]).toContain(r.subject)
      expect(r, `${r.subject} ${r.level}`).toMatchObject({ n: PRIMARY_PER_LEVEL, live: PRIMARY_PER_LEVEL, tp: PRIMARY_PER_LEVEL, untagged: PRIMARY_PER_LEVEL, spm: 0, origin: PRIMARY_PER_LEVEL })
    }
  })

  it('sets form_origin t1_t3 on Darjah rows and t4/t5 on Tingkatan rows', async () => {
    const rows = await t.db.query<{ level: string; origin: string; n: number }>(
      `select l.code as level, v.form_origin as origin, count(*)::int as n
         from question_versions v join education_levels l on l.id = v.education_level_id
        where v.number_label like 'SEED-POOL-%' group by l.code, v.form_origin`,
    )
    for (const r of rows) expect(r.origin, r.level).toBe(r.level === 'T4' ? 't4' : r.level === 'T5' ? 't5' : 't1_t3')
    expect(rows.filter((r) => r.level.startsWith('D'))).toHaveLength(PRIMARY_LEVELS.length)
  })

  it('leaves the Tingkatan pool as it was (24 per subject and level, all in the SPM pool) and inserts it first', async () => {
    const rows = (await poolRows()).filter((r) => r.level.startsWith('T'))
    for (const r of rows) expect(r, `${r.subject} ${r.level}`).toMatchObject({ n: POOL_PER_LEVEL, spm: POOL_PER_LEVEL, origin: POOL_PER_LEVEL })
    const [order] = await t.db.query<{ t_max: string; d_min: string }>(
      `select max(q.id) filter (where l.code like 'T%')::text as t_max, min(q.id) filter (where l.code like 'D%')::text as d_min
         from questions q join question_versions v on v.question_id = q.id join education_levels l on l.id = v.education_level_id
        where v.number_label like 'SEED-POOL-%'`,
    )
    expect(BigInt(order?.t_max ?? 0)).toBeLessThan(BigInt(order?.d_min ?? 0))
  })

  it('is idempotent: a second run inserts nothing', async () => {
    const count = async () => (await t.db.query<{ n: number }>(`select count(*)::int as n from questions`))[0]?.n
    const before = await count()
    await runSeeds([questionPoolSeed], { prisma: t.db.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
    expect(await count()).toBe(before)
  })

  /** A Darjah pupil of the population (fictitious, example.test or a demo username): logs in with the demo password. */
  const pupil = async (grade: number) => {
    const [u] = await t.db.query<{ email: string | null; username: string | null; school_id: string | null }>(
      `select u.email, u.username, u.school_id::text as school_id from users u
         join user_roles r on r.user_id = u.id and r.role = 'student'
        where u.grade = $1 and u.is_active order by u.id limit 1`,
      [grade],
    )
    if (!u) throw new Error(`no active pupil at grade ${String(grade)} in the PoC population`)
    const agent = t.agent()
    const identifier = u.email ?? (u.username as string)
    const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false, ...(u.email ? {} : { schoolId: u.school_id }) })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const csrf = SessionSchema.parse(res.body.data).csrf
    return {
      get: (url: string) => agent.get(url),
      post: (url: string, body: object) => (agent.post(url) as request.Test).set('X-CSRF-Token', csrf).send(body),
    }
  }

  // Secondary-only (2026-10-29): the Darjah levels are inactive, so the Darjah pool is seeded but never offered or drawn.
  describe('the Darjah pool is hidden (secondary-only)', () => {
    it('keeps D1 to D6 as inactive education levels and T1 to T5 active', async () => {
      const rows = await t.db.query<{ code: string; is_active: boolean }>(`select code, is_active from education_levels order by sort_order`)
      expect(rows.filter((r) => r.is_active).map((r) => r.code)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
      expect(rows.filter((r) => !r.is_active).map((r) => r.code)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6'])
    })

    it('a Tingkatan 4 pupil practises, and plays solo and Jutawan, on Tingkatan questions only', async () => {
      const p = await pupil(10)
      const levelsOf = async (ids: string[]) =>
        (
          await t.db.query<{ code: string }>(
            `select distinct l.code from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
               join education_levels l on l.id = v.education_level_id where q.id = any($1::bigint[])`,
            [ids],
          )
        ).map((r) => r.code)
      for (const subjectCode of PRIMARY_SUBJECTS) {
        const res = await p.post('/api/practice/sessions', { mode: 'random', subjectCode, count: PRACTICE_MAX })
        expect(res.status, `${subjectCode}: ${JSON.stringify(res.body)}`).toBe(201)
        const ids = (res.body.data.questions as { id: string }[]).map((x) => x.id)
        for (const code of await levelsOf(ids)) expect(OFFERED_LEVEL_CODES, subjectCode).toContain(code)
      }
      // A Darjah level is refused on the practice start and on Jutawan.
      const d1 = await p.post('/api/practice/sessions', { mode: 'random', subjectCode: 'MATH', count: PRACTICE_MAX, levelId: levelId.get('D1') })
      expect(d1.status).toBe(422)
      expect((await p.get('/api/games/jutawan?darjah=1')).status).toBe(422)
      // Kad Memori draws over Tingkatan 1 to 5 only.
      const res = await p.get('/api/games/solo/kad-memori')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const used = await t.db.query<{ code: string }>(
        `select distinct l.code from game_session_items i join questions q on q.id = i.question_id
           join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
           join education_levels l on l.id = v.education_level_id where i.session_id = $1::uuid`,
        [res.body.data.sessionId],
      )
      for (const r of used) expect(r.code).toMatch(/^T[1-5]$/)
    })
  })
})
