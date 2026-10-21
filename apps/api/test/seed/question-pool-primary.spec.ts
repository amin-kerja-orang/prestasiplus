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
import { MEMORY_CARDS, SOLO_INFO, SUSUN_MAX_ANSWER } from '../../src/modules/games/solo/play/solo.rules'
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
  it('covers exactly the levels practice random offers, for pool subjects the curriculum links to every one of them', () => {
    expect([...PRIMARY_LEVELS]).toEqual([...OFFERED_LEVEL_CODES])
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
              count(*) filter (where q.live_version_no = 1 and v.status = 'published' and q.is_active and v.type = 'mcq')::int as live,
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

  for (const grade of [1, 4]) {
    describe(`a Darjah ${String(grade)} pupil`, () => {
      let p: Awaited<ReturnType<typeof pupil>>
      beforeAll(async () => {
        p = await pupil(grade)
      })

      it(`starts practice random with ${PRACTICE_MAX} questions in every pool subject, over D1 to D4 and at each level (201)`, async () => {
        for (const subjectCode of PRIMARY_SUBJECTS) {
          const any = await p.post('/api/practice/sessions', { mode: 'random', subjectCode, count: PRACTICE_MAX })
          expect(any.status, `${subjectCode}: ${JSON.stringify(any.body)}`).toBe(201)
          expect(any.body.data.questions).toHaveLength(PRACTICE_MAX)
          for (const level of PRIMARY_LEVELS) {
            const res = await p.post('/api/practice/sessions', { mode: 'random', subjectCode, count: PRACTICE_MAX, levelId: levelId.get(level) })
            expect(res.status, `${subjectCode} ${level}: ${JSON.stringify(res.body)}`).toBe(201)
            expect(res.body.data.questions).toHaveLength(PRACTICE_MAX)
          }
        }
      })

      it('lists the games and the Jutawan subjects at the pupil level, and starts a Jutawan run', async () => {
        expect((await p.get('/api/games/hub')).status).toBe(200)
        const page = await p.get(`/api/games/jutawan?darjah=${String(grade)}`)
        expect(page.status).toBe(200)
        const tiles = page.body.data.subjects as { id: string; count: number }[]
        expect(tiles.length).toBeGreaterThanOrEqual(PRIMARY_SUBJECTS.length)
        for (const tile of tiles) expect(tile.count).toBeGreaterThanOrEqual(PRIMARY_PER_LEVEL)
        const run = await p.post('/api/games/jutawan/start', { subject: tiles[0]?.id, darjah: grade })
        expect(run.status, JSON.stringify(run.body)).toBe(200)
      })

      it('starts each solo game with a full set of items drawn at the pupil level (Kad Memori: over D1 to D4)', async () => {
        const offered = PRIMARY_LEVELS.map((l) => levelId.get(l))
        for (const game of ['betul-salah', 'cabaran-kilat', 'tembak-jawapan', 'susun-jawapan', 'kad-memori'] as const) {
          const res = await p.get(`/api/games/solo/${game}`)
          expect(res.status, `${game}: ${JSON.stringify(res.body)}`).toBe(200)
          const d = res.body.data as { sessionId: string; statements?: unknown[]; questions?: unknown[]; puzzles?: unknown[]; cards?: unknown[] }
          const n = (d.statements ?? d.questions ?? d.puzzles ?? d.cards ?? []).length
          expect(n, game).toBe(game === 'kad-memori' ? MEMORY_CARDS : SOLO_INFO[game].items)
          const levels = await t.db.query<{ level: string }>(
            `select distinct v.education_level_id::text as level from game_session_items i
               join questions q on q.id = i.question_id
               join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
              where i.session_id = $1::uuid`,
            [d.sessionId],
          )
          const allowed = game === 'kad-memori' ? offered : [levelId.get(`D${String(grade)}`)]
          for (const l of levels) expect(allowed, game).toContain(l.level)
        }
      })
    })
  }
})
