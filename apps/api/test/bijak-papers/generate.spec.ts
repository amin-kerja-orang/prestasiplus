import { BijakPaperCoverSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  type BijakPool,
  type BijakQuestionInfo,
  type BijakQuestionSource,
  type BijakServedSource,
} from '../../src/modules/bijak/papers'
import { POC_BANK, pocQuestionId } from '../../src/modules/bijak/papers/poc'
import { count, expectError, loginAs, bootPapersApp, type Client, type PapersTestApp } from './helpers'

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
    expect(cover.sections.map((s) => [s.label, s.questionCount, s.marks, s.instruction])).toEqual([
      ['Bahagian A', 3, expect.any(Number), 'Jawab semua soalan.'],
      ['Bahagian B', 1, expect.any(Number), 'Jawab semua soalan.'],
      ['Bahagian C', 2, expect.any(Number), 'Jawab 1 daripada 2 soalan.'],
    ])
    expect(cover.sections[2]).toMatchObject({ chooseN: 1 })
    expect(cover.marks).toBe(cover.sections.reduce((n, s) => n + s.marks, 0))
    expect(cover.instructions).toHaveLength(3)
    expect(cover.reference).toHaveLength(1)
    const row = (await t.db.query<{ kind: string; status: string; generated_for_user_id: string; is_test: boolean; blueprint_id: string | null }>(
      `select kind, status, generated_for_user_id::text, is_test, blueprint_id::text from papers where id = $1`,
      [paperId],
    ))[0]
    expect(row).toMatchObject({ kind: 'jana', status: 'published', generated_for_user_id: student.userId, is_test: false })
    expect(row?.blueprint_id).not.toBeNull()
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
      await t.db.query(`update blueprints set source = 'draft' where code = '1449/1'`)
      expectError(await generate('MAT', 1), 'NO_BLUEPRINT', 422)
      await t.db.query(`update blueprints set source = 'spec', status = 'retired' where code = '1449/1'`)
      expectError(await generate('MAT', 1), 'NO_BLUEPRINT', 422)
      await t.db.query(`update blueprints set status = 'draft' where code = '1449/1'`)
      expectError(await generate('MAT', 1), 'NO_BLUEPRINT', 422)
      expect(await papers()).toBe(before)
      await t.db.query(`update blueprints set status = 'active' where code = '1449/1'`)
      expect((await generate('MAT', 1)).status).toBe(201)
    })
  })

  it('422 SHORTAGE with the shortage list instead of a short paper, no paper row (AC 4)', async () => {
    const before = await count(t.db, `select count(*) n from papers where kind = 'jana'`)
    const res = await generate('SN', 1)
    const error = expectError(res, 'SHORTAGE', 422, 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.')
    expect(error.details).toEqual({ shortages: [{ section: 'Bahagian A', need: 40, have: 0 }] })
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

describe('Jana Kertas through the question port (a BE-09 stand-in)', () => {
  let t: PapersTestApp
  let student: Client

  const info = new Map<string, BijakQuestionInfo>()
  const entries: BijakPool['entries'] = []
  for (let i = 1; i <= 12; i++) {
    const id = String(7000 + i)
    info.set(id, { id, marks: (i % 3) + 1, groupId: null, versionNo: 3 })
    entries.push({ questionId: id })
  }
  for (const id of ['7101', '7102']) {
    info.set(id, { id, marks: 2, groupId: 'g1', versionNo: 1 })
    entries.push({ questionId: id, groupId: 'g1' })
  }
  const source: BijakQuestionSource = {
    getMany: async (ids) => new Map(ids.flatMap((id) => (info.has(id) ? [[id, info.get(id) as BijakQuestionInfo] as const] : []))),
    pool: async (pool) => (pool === 'MAT1-A' ? { entries, groups: new Map([['g1', ['7101', '7102']]]) } : { entries: [], groups: new Map() }),
  }

  beforeAll(async () => {
    t = await bootPapersApp({ questionSource: source })
    student = await loginAs(t, 'pelajar@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  it('draws from the provided pool, pins the version and derives marks from the provided marks', async () => {
    const res = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = paperIdOf(res)
    const rows = await placed(t, id)
    expect(rows).toHaveLength(10)
    expect(rows.every((r) => info.has(r.question_id))).toBe(true)
    const budget = (await t.db.query<{ mark_budget: number }>(`select mark_budget from paper_sections where paper_id = $1`, [id]))[0]?.mark_budget
    expect(budget).toBe(rows.reduce((n, r) => n + (info.get(r.question_id)?.marks ?? 0), 0))
    const versions = await t.db.query<{ pinned_version_no: number; question_id: string }>(
      `select pl.pinned_version_no, pl.question_id::text from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`,
      [id],
    )
    expect(versions.every((v) => v.pinned_version_no === (info.get(v.question_id)?.versionNo ?? -1))).toBe(true)
    const cover = envelopeOf(BijakPaperCoverSchema).parse((await student.get(`/api/bijak/papers/${id}`)).body).data
    expect(cover.marks).toBe(budget)
    // The fake pool is empty for every other pool: MAT Kertas 2 is a shortage.
    expectError(await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 2 }), 'SHORTAGE', 422)
  })
})

describe('rate limit', () => {
  it('429 RATE_LIMITED on generate above the per-user ceiling', async () => {
    const t = await bootPapersApp({ env: { THROTTLE_BIJAK_GENERATE_PER_MINUTE: '3' } })
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
