import { BijakPaperCoverSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { QuestionFacts } from '@pp/exam-core'

import type { BijakQuestionInfo, BijakQuestionSource, BijakServedSource } from '../../src/modules/bijak/papers'
import { POC_BANK, pocQuestionId } from '../../src/modules/bijak/papers/poc'
import type { BijakPoolSource } from '../../src/modules/bijak/papers/pool-source'
import { NOT_SERVING, SERVING } from '../support/serve-blueprints'
import { count, expectError, loginAs, bootPapersApp, serveSeededBlueprints, setPocMarkBudgets, type Client, type PapersTestApp } from './helpers'

const served = new Set<string>()
const fakeServed: BijakServedSource = { servedQuestionIds: async () => served }

interface Placed {
  paper_id: string
  section: string
  question_id: string
}

async function placed(t: PapersTestApp, paperId: string): Promise<Placed[]> {
  return t.db.query<Placed>(
    `select s.paper_id::text, s.label as section, pl.question_id::text
       from paper_placements pl join paper_sections s on s.id = pl.paper_section_id
      where s.paper_id = $1 order by s.position, pl.position`,
    [paperId],
  )
}

const paperIdOf = (res: { body: unknown }): string => (res.body as { data: { paperId: string } }).data.paperId

describe('POST /api/bijak/papers/generate (Jana Kertas, BE-15)', () => {
  let t: PapersTestApp
  let student: Client

  beforeAll(async () => {
    t = await bootPapersApp({ served: fakeServed })
    await setPocMarkBudgets(t.db)
    await serveSeededBlueprints(t.db)
    student = await loginAs(t, 'pelajar@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const generate = (subject: string, kertas: number) => student.post('/api/bijak/papers/generate', { subject, kertas })

  it('201 { paperId }; the new paper is a private jana paper with the blueprint structure (AC 4, 5)', async () => {
    const res = await generate('MAT', 2)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const paperId = paperIdOf(res)
    const cover = envelopeOf(BijakPaperCoverSchema).parse((await student.get(`/api/bijak/papers/${paperId}`)).body).data
    expect(cover).toMatchObject({
      id: paperId,
      kind: 'jana',
      status: 'belum',
      title: 'Kertas Jana Matematik Kertas 2 (#1)',
      subject: 'MAT',
      kertas: 2,
      code: '1449/2',
      durationMin: 150,
      year: 2026,
    })
    // D75: the marks of every section equal the blueprint budget exactly (9 / 6 / 6 for the seeded 1449/2).
    expect(cover.sections.map((s) => [s.label, s.questionCount, s.marks, s.instruction])).toEqual([
      ['Bahagian A', 3, 9, 'Jawab semua soalan.'],
      ['Bahagian B', 1, 6, 'Jawab semua soalan.'],
      ['Bahagian C', 2, 6, 'Jawab 1 daripada 2 soalan.'],
    ])
    expect(cover.sections[2]).toMatchObject({ chooseN: 1 })
    expect(cover.marks).toBe(21)
    expect(cover.instructions).toHaveLength(3)
    expect(cover.reference).toHaveLength(1)
    const row = (await t.db.query<{ kind: string; status: string; generated_for_user_id: string; is_test: boolean; blueprint_id: string | null }>(
      `select kind, status, generated_for_user_id::text, is_test, blueprint_id::text from papers where id = $1`,
      [paperId],
    ))[0]
    expect(row).toMatchObject({ kind: 'jana', status: 'published', generated_for_user_id: student.userId, is_test: false })
    expect(row?.blueprint_id).not.toBeNull()
    // AC-34.7: the standard report of the composition is stored with the paper (blueprint version, achieved marks).
    const stored = (await t.db.query<{ standard_report: { blueprintVersion?: number } | null }>(`select standard_report from papers where id = $1`, [paperId]))[0]?.standard_report
    expect(stored).not.toBeNull()
    expect(stored).toHaveProperty('sections')
  })

  it('a generated paper is not in the Kertas Pilihan list', async () => {
    const list = (await student.get('/api/bijak/papers')).body as { data: { kind: string }[] }
    expect(list.data.every((p) => p.kind === 'pilihan')).toBe(true)
  })

  it('every call creates a new paper id (and the next title number) (AC 5)', async () => {
    const a = paperIdOf(await generate('MAT', 1))
    const b = paperIdOf(await generate('MAT', 1))
    expect(a).not.toBe(b)
    const title = async (id: string) => ((await student.get(`/api/bijak/papers/${id}`)).body as { data: { title: string } }).data.title
    expect(await title(a)).toMatch(/^Kertas Jana Matematik Kertas 1 \(#\d+\)$/)
    expect(await title(a)).not.toBe(await title(b))
  })

  it("another user's GET of the generated paper is 404 \"Kertas tidak ditemui\" (AC 5)", async () => {
    const id = paperIdOf(await generate('SN', 2))
    const other = await loginAs(t, 'pelajar2@demo.test')
    expectError(await other.get(`/api/bijak/papers/${id}`), 'NOT_FOUND', 404, 'Kertas tidak ditemui')
    expect((await student.get(`/api/bijak/papers/${id}`)).status).toBe(200)
    // Not even an admin in Mod Pelajar sees it.
    const admin = await loginAs(t, 'admin@demo.test')
    await admin.enterMod()
    expectError(await admin.get(`/api/bijak/papers/${id}`), 'NOT_FOUND', 404, 'Kertas tidak ditemui')
  })

  it('keeps stimulus groups together, in order, and never repeats a question inside one paper (AC 4)', async () => {
    const groups = POC_BANK.groups.filter((g) => g.id.startsWith('mat2-segitiga'))
    for (let i = 0; i < 12; i++) {
      t.clock.advance(1000)
      const rows = await placed(t, paperIdOf(await generate('MAT', 2)))
      const ids = rows.map((r) => r.question_id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const g of groups) {
        const members = g.questionIds.map((k) => pocQuestionId(k).toString())
        const at = members.map((m) => ids.indexOf(m))
        if (at.every((x) => x === -1)) continue
        expect(at.every((x) => x !== -1), `group ${g.id} split`).toBe(true)
        expect(at[1]).toBe((at[0] as number) + 1)
      }
    }
  })

  it('with a fixed clock the same inputs give the same paper (AC 4)', async () => {
    const first = paperIdOf(await generate('MAT', 1))
    const a = (await placed(t, first)).map((r) => r.question_id)
    // Remove the paper so the user is back to the same state, same clock: same seed.
    await t.db.query(`delete from papers where id = $1`, [first])
    const second = paperIdOf(await generate('MAT', 1))
    expect(second).not.toBe(first)
    const b = (await placed(t, second)).map((r) => r.question_id)
    expect(b).toEqual(a)
    // A later clock reading gives a different seed, hence (for a pool of 44) a different paper.
    t.clock.advance(60_000)
    const third = paperIdOf(await generate('MAT', 1))
    expect((await placed(t, third)).map((r) => r.question_id)).not.toEqual(a)
  })

  it('prefers questions the user has not been served before when the pool allows (AC 4)', async () => {
    const singles = POC_BANK.pool.filter((e) => e.pool === 'MAT1-A' && !POC_BANK.questions.find((q) => q.id === e.questionId)?.groupId)
    const unseen = singles.slice(0, 14).map((e) => pocQuestionId(e.questionId).toString())
    served.clear()
    for (const e of POC_BANK.pool.filter((p) => p.pool === 'MAT1-A')) {
      const id = pocQuestionId(e.questionId).toString()
      if (!unseen.includes(id)) served.add(id)
    }
    try {
      for (let i = 0; i < 5; i++) {
        t.clock.advance(1000)
        const ids = (await placed(t, paperIdOf(await generate('MAT', 1)))).map((r) => r.question_id)
        expect(ids).toHaveLength(10)
        expect(ids.every((id) => unseen.includes(id))).toBe(true)
      }
      // Everything served: the paper is still made (seen questions fill the gap, as in the mock).
      for (const e of POC_BANK.pool.filter((p) => p.pool === 'MAT1-A')) served.add(pocQuestionId(e.questionId).toString())
      expect((await generate('MAT', 1)).status).toBe(201)
    } finally {
      served.clear()
    }
  })

  describe('422 NO_BLUEPRINT (AC 3)', () => {
    const papers = () => count(t.db, `select count(*) n from papers where kind = 'jana'`)

    it('no blueprint for the pair, an unknown subject: no paper row', async () => {
      const before = await papers()
      const noPair = expectError(await generate('SEJ', 2), 'NO_BLUEPRINT', 422, 'Belum ada kontrak untuk subjek dan kertas ini')
      expect(noPair).not.toHaveProperty('details')
      expectError(await generate('NOPE', 1), 'NO_BLUEPRINT', 422)
      expectError(await generate('MAT', 9), 'NO_BLUEPRINT', 422)
      expect(await papers()).toBe(before)
    })

    it('a blueprint whose source is Draf, a retired or a draft version: no paper row', async () => {
      const before = await papers()
      await t.db.query(`update blueprints set source = 'draft', serves_students = false, verification_id = null where code = '1449/1'`)
      expectError(await generate('MAT', 1), 'NO_BLUEPRINT', 422)
      await t.db.query(`update blueprints set source = 'spec', status = 'retired' where code = '1449/1'`)
      expectError(await generate('MAT', 1), 'NO_BLUEPRINT', 422)
      await t.db.query(`update blueprints set status = 'draft' where code = '1449/1'`)
      expectError(await generate('MAT', 1), 'NO_BLUEPRINT', 422)
      expect(await papers()).toBe(before)
      await t.db.query(`update blueprints set status = 'active', ${SERVING} where code = '1449/1'`)
      expect((await generate('MAT', 1)).status).toBe(201)
    })

    // AC-R1-15.3 / D76 / O-6: a pupil generates from the serving (Disahkan) version only.
    it('a Spec head that serves nobody is refused for a pupil and for Admin Sekolah in Mod Pelajar', async () => {
      const before = await papers()
      await t.db.query(`update blueprints set ${NOT_SERVING} where code = '1449/1'`)
      expectError(await generate('MAT', 1), 'NO_BLUEPRINT', 422)
      const school = await loginAs(t, 'adminsekolah@demo.test')
      await school.enterMod()
      expectError(await school.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 }), 'NO_BLUEPRINT', 422)
      expect(await papers()).toBe(before)
      await t.db.query(`update blueprints set ${SERVING} where code = '1449/1'`)
    })

    it('a Spec head over a retired serving version: the pupil still generates from the serving version', async () => {
      // addVersion retires the Disahkan row (it keeps serves_students) and the new head is Spec.
      await t.db.query(`update blueprints set status = 'retired', duration_min = 77 where code = '1449/1'`)
      await t.db.query(
        `insert into blueprints (structure_hash, subject_id, kertas, code, version, status, source, duration_min, instructions, reference_sheets)
         select repeat('c', 64), subject_id, kertas, code, 2, 'active', 'spec', 99, instructions, reference_sheets from blueprints where code = '1449/1' and version = 1`,
      )
      await t.db.query(
        `insert into blueprint_sections (blueprint_id, position, label, rule_type, rule_n, question_count, mark_budget, compulsory, pool, instruction)
         select (select id from blueprints where code = '1449/1' and version = 2), position, label, rule_type, rule_n, question_count, mark_budget, compulsory, pool, instruction
           from blueprint_sections where blueprint_id = (select id from blueprints where code = '1449/1' and version = 1)`,
      )
      const res = await generate('MAT', 1)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const row = (await t.db.query<{ printed_duration_min: number }>(`select printed_duration_min from papers where id = $1`, [paperIdOf(res)]))[0]
      expect(row?.printed_duration_min).toBe(77) // the serving version, not the Spec head (99)
      // restore
      await t.db.query(`delete from blueprints where code = '1449/1' and version = 2`)
      await t.db.query(`update blueprints set status = 'active', duration_min = 75 where code = '1449/1' and version = 1`)
    })

    it('Admin Pusat in Mod Pelajar may generate from a Spec head (test data); Admin Sekolah may not', async () => {
      await t.db.query(`update blueprints set ${NOT_SERVING} where code = '1449/1'`)
      const admin = await loginAs(t, 'admin@demo.test')
      await admin.enterMod()
      const res = await admin.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const row = (await t.db.query<{ is_test: boolean }>(`select is_test from papers where id = $1`, [paperIdOf(res)]))[0]
      expect(row?.is_test).toBe(true)
      // a Draf head is refused even for Admin Pusat
      await t.db.query(`update blueprints set source = 'draft' where code = '1449/1'`)
      const again = await admin.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
      expectError(again, 'NO_BLUEPRINT', 422)
      await t.db.query(`update blueprints set ${SERVING} where code = '1449/1'`)
    })
  })

  it('422 SHORTAGE with the shortage list instead of a short paper, no paper row (AC 4)', async () => {
    const before = await count(t.db, `select count(*) n from papers where kind = 'jana'`)
    const res = await generate('SN', 1)
    const error = expectError(res, 'SHORTAGE', 422, 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.')
    expect(error.details).toEqual({ shortages: [{ section: 'Bahagian A', kind: 'count', need: 40, have: 0 }] })
    expect(await count(t.db, `select count(*) n from papers where kind = 'jana'`)).toBe(before)
  })

  it('422 VALIDATION_ERROR for an invalid body', async () => {
    const bad = async (body: unknown) => expectError(await student.post('/api/bijak/papers/generate', body), 'VALIDATION_ERROR', 422)
    expect((await bad({})).fields).toMatchObject({ subject: expect.any(String), kertas: expect.any(String) })
    expect((await bad({ subject: 'MAT', kertas: 0 })).fields).toHaveProperty('kertas')
    expect((await bad({ subject: 'MAT', kertas: 1.5 })).fields).toHaveProperty('kertas')
    expect((await bad({ subject: '', kertas: 1 })).fields).toHaveProperty('subject')
    expect((await bad({ subject: 'M'.repeat(33), kertas: 1 })).fields).toHaveProperty('subject')
    expect((await bad({ subject: 'MAT', kertas: '2' })).fields).toHaveProperty('kertas')
  })

  it('flags the paper as test data when generated in Mod Pelajar', async () => {
    const school = await loginAs(t, 'adminsekolah@demo.test')
    await school.enterMod()
    const res = await school.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
    expect(res.status).toBe(201)
    const row = (await t.db.query<{ is_test: boolean; generated_for_user_id: string }>(`select is_test, generated_for_user_id::text from papers where id = $1`, [paperIdOf(res)]))[0]
    expect(row).toMatchObject({ is_test: true, generated_for_user_id: school.userId })
  })
})

describe('Jana Kertas through the pool source (standard facts, D75)', () => {
  let t: PapersTestApp
  let student: Client

  const leaf = (marks: number, over: Partial<QuestionFacts['leaves'][number]> = {}): QuestionFacts['leaves'][number] => ({
    marks,
    mode: 'mcq',
    tp: 2,
    kbat: false,
    hasKey: true,
    ...over,
  })
  const fact = (id: string, over: Partial<QuestionFacts> = {}): QuestionFacts => ({
    id,
    groupId: null,
    groupPosition: null,
    versionNo: 3,
    tagReview: false,
    unit: { nodeId: '10', level: 'T4', code: '1' },
    formOrigin: 't4',
    pools: ['MAT1-A'],
    leaves: [leaf(1)],
    ...over,
  })
  // 12 one-mark singles and a group of two sharing a stimulus: MAT Kertas 1 (10 x 1 mark) is exactly satisfiable.
  const bank: QuestionFacts[] = [
    ...Array.from({ length: 12 }, (_, i) => fact(String(7001 + i))),
    fact('7101', { groupId: 'g1', groupPosition: 1, groupSize: 2 }),
    fact('7102', { groupId: 'g1', groupPosition: 2, groupSize: 2 }),
  ]
  // A candidate list the test swaps per case; only MAT Kertas 1 has facts, any other pair is a shortage.
  let candidates: QuestionFacts[] = bank
  const refused = new Set<string>()
  const source: BijakPoolSource = {
    candidates: async (scope) => (scope.subjectCode === 'MATH' ? candidates : []),
    seen: async () => new Set(),
  }

  // Reads of a generated paper (the cover) take marks from the question port, not from the pool facts.
  const questions: BijakQuestionSource = {
    getMany: async (ids) =>
      new Map(
        ids.flatMap((id) => {
          const f = bank.find((x) => x.id === id)
          // `refused` stands for the BE-09 bridge refusing a candidate (option image, group without one stimulus, missing file ...).
          return f && !refused.has(id) ? [[id, { id, marks: 1, groupId: f.groupId, versionNo: f.versionNo } satisfies BijakQuestionInfo] as const] : []
        }),
      ),
    pool: async () => ({ entries: [], groups: new Map() }),
  }

  beforeAll(async () => {
    t = await bootPapersApp({ poolSource: source, questionSource: questions })
    await serveSeededBlueprints(t.db)
    student = await loginAs(t, 'pelajar@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const generate = () => student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })

  it('composes from the provided facts, pins the fact version and derives marks from the facts', async () => {
    candidates = bank
    for (let i = 0; i < 6; i++) {
      t.clock.advance(1000)
      const res = await generate()
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const id = paperIdOf(res)
      const rows = await placed(t, id)
      expect(rows).toHaveLength(10)
      const known = new Set(bank.map((f) => f.id))
      expect(rows.every((r) => known.has(r.question_id))).toBe(true)
      // D90: a group is placed whole and consecutively, or not at all.
      const ids = rows.map((r) => r.question_id)
      const at = ['7101', '7102'].map((m) => ids.indexOf(m))
      if (at.some((x) => x !== -1)) {
        expect(at.every((x) => x !== -1), 'group split').toBe(true)
        expect(at[1]).toBe((at[0] as number) + 1)
      }
      const budget = (await t.db.query<{ mark_budget: number }>(`select mark_budget from paper_sections where paper_id = $1`, [id]))[0]?.mark_budget
      expect(budget).toBe(10)
      const versions = await t.db.query<{ pinned_version_no: number }>(
        `select pl.pinned_version_no from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`,
        [id],
      )
      expect(versions.every((v) => v.pinned_version_no === 3)).toBe(true)
      const cover = envelopeOf(BijakPaperCoverSchema).parse((await student.get(`/api/bijak/papers/${id}`)).body).data
      expect(cover.marks).toBe(10)
    }
    // The fake has no facts for any other pair: MAT Kertas 2 is a shortage.
    expectError(await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 2 }), 'SHORTAGE', 422)
  })

  it('exact or refuse: ineligible facts are never used, and a pool one short refuses without a paper row', async () => {
    const count = async (): Promise<number> => Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]?.n)
    const before = await count()
    // 9 usable singles + 3 that are not eligible (no key, tags awaiting review, no marks): fewer than the 10 slots.
    candidates = [
      ...bank.slice(0, 9),
      fact('7010', { leaves: [leaf(1, { hasKey: false })] }),
      fact('7011', { tagReview: true }),
      fact('7012', { leaves: [leaf(0)] }),
    ]
    const error = expectError(await generate(), 'SHORTAGE', 422)
    expect(error.details).toMatchObject({ shortages: [{ section: 'Objektif', need: 10 }] })
    expect(await count()).toBe(before)
    candidates = bank
  })

  it('a candidate the bridge refuses is never placed: the paper is composed from the others', async () => {
    candidates = bank
    refused.clear()
    for (const id of ['7001', '7002']) refused.add(id)
    try {
      for (let i = 0; i < 8; i++) {
        t.clock.advance(1000)
        const ids = (await placed(t, paperIdOf(await generate()))).map((r) => r.question_id)
        expect(ids).toHaveLength(10)
        expect(ids.filter((id) => refused.has(id))).toEqual([])
      }
    } finally {
      refused.clear()
    }
  })

  it('a pool left short by the bridge refuses (SHORTAGE) and writes no paper row: a refused group member drops its group', async () => {
    candidates = bank
    const before = Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]?.n)
    // 12 singles - 3 refused = 9, and the group (7101 refused) is incomplete, so 10 questions cannot be made.
    for (const id of ['7001', '7002', '7003', '7101']) refused.add(id)
    try {
      expectError(await generate(), 'SHORTAGE', 422)
      expect(Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]?.n)).toBe(before)
    } finally {
      refused.clear()
    }
  })

  it('a section whose marks no selection can reach refuses instead of making a paper with other marks', async () => {
    const before = Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]?.n)
    candidates = bank.map((f) => ({ ...f, leaves: [leaf(2)] })) // 10 questions of 2 marks cannot make the 10-mark budget
    expectError(await generate(), 'SHORTAGE', 422)
    expect(Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]?.n)).toBe(before)
    candidates = bank
  })
})

describe('rate limit', () => {
  it('429 RATE_LIMITED on generate above the per-user ceiling', async () => {
    const t = await bootPapersApp({ env: { THROTTLE_BIJAK_GENERATE_PER_MINUTE: '3' } })
    await serveSeededBlueprints(t.db)
    try {
      const student = await loginAs(t, 'pelajar@demo.test')
      for (let i = 0; i < 3; i++) expect((await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })).status).toBe(201)
      expectError(await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 }), 'RATE_LIMITED', 429)
    } finally {
      delete process.env.THROTTLE_BIJAK_GENERATE_PER_MINUTE
      await t.close()
    }
  }, 120_000)
})
