import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BijakBuilderEditorSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPublishResultSchema,
  BijakBuilderReviewSchema,
  BijakBuilderPoolUnitSchema,
  BijakBuilderSourceFiltersSchema,
  BijakDraftGenerateResultSchema,
  BijakPoolPreviewSchema,
  envelopeOf,
  listEnvelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { BijakPoolSource } from '../../src/modules/bijak/papers'
import type { LeafFact, QuestionFacts } from '../../src/modules/bijak/papers/exam-core.adapter'
import type { BuilderQuestionOrigin } from '../../src/modules/exam/builder/ports'
import { NOT_SERVING, serveSeededBlueprints, SERVING } from '../support/serve-blueprints'
import { FakeBank } from './fakes'
import { ACCOUNTS, bootBuilderApp, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

vi.setConfig({ testTimeout: 120_000 })

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Generated = envelopeOf(BijakDraftGenerateResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)
const Review = envelopeOf(BijakBuilderReviewSchema)
const Preview = envelopeOf(BijakPoolPreviewSchema)
const Pool = listEnvelopeOf(BijakBuilderPoolUnitSchema).extend({ filters: BijakBuilderSourceFiltersSchema })
const List = listEnvelopeOf(BijakBuilderPaperSummarySchema)

const ids = {
  a: ['720001', '720002', '720003', '720004', '720005', '720006'],
  b: ['720011', '720012', '720013'],
  c: ['720021', '720022', '720023'],
  g: ['720031', '720032'],
  c2: ['720041', '720042'],
  noKey: '720051',
}
const GROUP = '820001'
const ORIGIN: Record<string, BuilderQuestionOrigin> = {
  '720001': { year: 2025, negeri: 'Johor' },
  '720002': { year: 2025, negeri: 'Johor' },
  '720003': { year: 2024, negeri: 'mrsm' },
  '720004': { year: 2024, negeri: 'Kedah' },
  '720011': { year: 2025, negeri: 'Johor' },
  '720021': { year: 2025, negeri: 'Johor' },
  '720022': { year: 2025, negeri: 'Johor' },
  // Only the first member of the group has the value: the group still matches as one unit.
  '720031': { year: 2023, negeri: 'SBP' },
}

class OriginBank extends FakeBank {
  async originsOf(list: readonly string[]): Promise<ReadonlyMap<string, BuilderQuestionOrigin>> {
    return new Map(list.flatMap((id) => (ORIGIN[id] ? [[id, ORIGIN[id]!] as const] : [])))
  }
}

/** What the production pool returns: facts of every id, tagged per section. */
class TaggedPool implements BijakPoolSource {
  noKey = new Set<string>()
  constructor(private readonly marks: Record<string, number>, private readonly tags: Record<string, string>) {}
  async candidates(): Promise<QuestionFacts[]> {
    return Object.keys(this.marks).map((id) => {
      const leaf: LeafFact = { marks: this.marks[id]!, mode: 'mcq', tp: 2, kbat: false, hasKey: !this.noKey.has(id), unit: { nodeId: '9001', level: 'T4', code: '1.0' } }
      const grouped = ids.g.includes(id)
      return {
        id,
        groupId: grouped ? GROUP : null,
        groupPosition: grouped ? ids.g.indexOf(id) + 1 : null,
        ...(grouped ? { groupSize: ids.g.length } : {}),
        versionNo: 1,
        tagReview: false,
        unit: { nodeId: '9001', level: 'T4' as const, code: '1.0' },
        formOrigin: 't4' as const,
        pools: this.tags[id] ? [this.tags[id]!] : [],
        leaves: [leaf],
      }
    })
  }
  async seen(): Promise<ReadonlySet<string>> {
    return new Set()
  }
}

describe('S3-T02 One Set Builder', () => {
  let t: BuilderTestApp
  let bank: OriginBank
  let pool: TaggedPool
  let admin: Client
  let student: Client

  beforeAll(async () => {
    bank = new OriginBank()
    const marks: Record<string, number> = {}
    for (const id of [...ids.a, ...ids.b, ...ids.g]) marks[id] = 1
    for (const id of [...ids.c, ids.noKey]) marks[id] = 2
    for (const id of ids.c2) marks[id] = 3
    for (const [id, m] of Object.entries(marks)) bank.add({ id, marks: m, ...(ids.g.includes(id) ? { groupId: GROUP } : {}) })
    bank.addGroup(GROUP, ids.g)
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank })
    await serveSeededBlueprints(t.db)
    const tags = await t.db.query<{ pool: string }>(`select s.pool from blueprint_sections s join blueprints b on b.id = s.blueprint_id where b.code = '1449/2' and b.status = 'active' order by s.position`)
    const [A, B, C] = tags.map((r) => r.pool)
    const tagged: Record<string, string> = {}
    for (const id of [...ids.a, ...ids.g]) tagged[id] = A!
    for (const id of ids.b) tagged[id] = B!
    for (const id of [...ids.c, ids.noKey, ...ids.c2]) tagged[id] = C!
    pool = new TaggedPool(marks, tagged)
    pool.noKey.add(ids.noKey)
    t.papersPorts.providePoolSource(pool)
    admin = await loginAs(t, ACCOUNTS.admin)
    student = await loginAs(t, ACCOUNTS.student)
  })
  afterAll(async () => {
    await t.close()
  })

  const editor = async (id: string) => Editor.parse((await admin.get(`/api/admin/papers/${id}`)).body).data
  const generate = (body: Record<string, unknown> = {}) => admin.post('/api/admin/papers/generate', { subject: 'MAT', kertas: 2, ...body })
  const generated = async (body: Record<string, unknown> = {}): Promise<string> => {
    const res = await generate(body)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return Generated.parse(res.body).data.id
  }
  const preview = async (query: string) => {
    const res = await admin.get(`/api/admin/papers/pool-preview?subject=MAT&kertas=2${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Preview.parse(res.body).data
  }
  const review = async (id: string) => Review.parse((await admin.get(`/api/admin/papers/${id}/review`)).body).data
  const publish = async (id: string, body?: unknown) => Publish.parse((await admin.post(`/api/admin/papers/${id}/publish`, body)).body).data
  const setContract = (state: string) => t.db.query(`update blueprints set ${state} where code = '1449/2' and status = 'active'`)
  const listed = async (): Promise<string[]> => ((await student.get('/api/bijak/papers')).body.data as { id: string }[]).map((p) => p.id)
  const setGrade = (grade: number) => t.db.query(`update users set grade = $1 where id = $2`, [grade, BigInt(student.userId)])

  describe('Jana set (API-BIJAK-11, FR-ADM-Q13.2)', () => {
    it('answers { data: { id } } with the title and scope asked; omitted title and scope fall back to the default and the contract', async () => {
      const named = await editor(await generated({ title: '  Latih Tubi Mac  ', levelScope: 't5' }))
      expect(named.paper.title).toBe('Latih Tubi Mac')
      expect(named.paper.levelScope).toBe('t5')
      const plain = await editor(await generated())
      expect(plain.paper.title).toContain('Percubaan SPM')
      expect(plain.paper.levelScope).toBe('t4_t5')
      expect(plain.paper.sections.map((s) => s.questionIds.length)).toEqual([3, 1, 2])
    })

    it('a stated contract share sets the default scope', async () => {
      await t.db.query(`update blueprints set level_share = '{"t4":0,"t5":100}'::jsonb where code = '1449/2' and status = 'active'`)
      try {
        expect((await editor(await generated())).paper.levelScope).toBe('t5')
        expect((await preview('')).levelScope).toBe('t5')
      } finally {
        await t.db.query(`update blueprints set level_share = null where code = '1449/2' and status = 'active'`)
      }
    })

    it('a count below the total scales the sections, keeps their position and never splits a group; it publishes under the Disahkan contract', async () => {
      for (let i = 0; i < 12; i++) {
        const e = await editor(await generated({ count: 3 }))
        expect(e.paper.sections.map((s) => [s.label, s.questionCount, s.questionIds.length])).toEqual([
          ['Bahagian A', 2, 2],
          ['Bahagian C', 1, 1],
        ])
        const a = e.paper.sections[0]!.questionIds
        const hit = a.filter((id) => ids.g.includes(id))
        expect([0, 2]).toContain(hit.length)
        if (hit.length === 2) expect(a).toEqual(ids.g)
      }
      const id = await generated({ count: 3 })
      const positions = await t.db.query<{ position: number }>(`select position from paper_sections where paper_id = $1 order by position`, [id])
      expect(positions.map((r) => r.position)).toEqual([1, 3])
      const r = await review(id)
      expect(r.blockers).toEqual([])
      expect((await publish(id)).ok).toBe(true)
    })

    it('a count above the contract total is refused with the field; below 1 carries the PRD30 message', async () => {
      const above = expectError(await generate({ count: 7 }), 'VALIDATION_ERROR', 422)
      expect(above.fields).toEqual({ count: 'Bilangan soalan melebihi jumlah kontrak (6).' })
      expect(expectError(await generate({ count: 0 }), 'VALIDATION_ERROR', 422).fields).toEqual({ count: 'Bilangan soalan mesti antara 1 dan 100.' })
    })

    it('Tahun and Negeri narrow the draw; a pool that is then too small is a shortage, and nothing is created', async () => {
      const before = (await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]!.n
      const res = await generate({ years: [2025], negeri: ['johor'] })
      expectError(res, 'SHORTAGE', 422)
      expect((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]!.n).toBe(before)
      // 2 of Johor 2025 in A, 1 in B, 2 in C: a set of 4 scales to 2, 1, 1
      const e = await editor(await generated({ years: [2025], negeri: ['JOHOR'], count: 4 }))
      expect(e.paper.sections.map((s) => s.questionIds.length)).toEqual([2, 1, 1])
      expect(new Set(e.paper.sections[0]!.questionIds)).toEqual(new Set(['720001', '720002']))
    })

    it('a group matches Tahun and Negeri as one unit, whichever member carries the value', async () => {
      const p = await preview('&negeri=SBP')
      expect(p.eligibleTotal).toBe(2)
      expect(p.groupTotal).toBe(1)
    })

    it('Pratonton kolam: the fields of the Jana set form, and the verdict of the asked size', async () => {
      const all = await preview('')
      expect(all).toMatchObject({ groupTotal: 1, contractTotal: 6, levelScope: 't4_t5', verdict: 'boleh' })
      expect(all.filters).toEqual({ years: [2025, 2024, 2023], negeri: ['Johor', 'Kedah', 'MRSM', 'SBP'] })
      const narrow = await preview('&years=2024&years=2023')
      expect(narrow.eligibleTotal).toBe(4)
      expect(narrow.publishedTotal).toBe(4)
      // The options do not shrink with the filter.
      expect(narrow.filters).toEqual(all.filters)
      expect(narrow.verdict).toBe('tidak_boleh')
      expect((await preview('&count=2&negeri=Johor')).verdict).toBe('boleh')
      expect((await preview('&count=2')).sections.reduce((n, s) => n + s.slots, 0)).toBe(2)
    })

    it('Mula kosong takes the scope too; Salin set keeps it', async () => {
      const made = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2, levelScope: 't4' })
      expect((await editor(made.body.data.id as string)).paper.levelScope).toBe('t4')
      const copy = await admin.post(`/api/admin/papers/${made.body.data.id as string}/copy`)
      expect((await editor(copy.body.data.id as string)).paper.levelScope).toBe('t4')
      expect((await editor((await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })).body.data.id as string)).paper.levelScope).toBe('t4_t5')
    })
  })

  describe('Dilihat murid (PO decision item 6, FR-ADM-Q15.3)', () => {
    it('a pupil sees only the papers of their own Tingkatan; the list row shows the scope and origin', async () => {
      const t5Only = await generated({ levelScope: 't5' })
      expect((await publish(t5Only)).ok).toBe(true)
      const both = await generated({ levelScope: 't4_t5' })
      expect((await publish(both)).ok).toBe(true)

      await setGrade(10)
      expect(await listed()).not.toContain(t5Only)
      expect(await listed()).toContain(both)
      expectError(await student.get(`/api/bijak/papers/${t5Only}`), 'NOT_FOUND', 404)
      expect((await student.post('/api/bijak/attempts', { paperId: t5Only, mode: 'exam' })).status).toBe(404)

      await setGrade(11)
      expect(await listed()).toContain(t5Only)
      expect((await student.get(`/api/bijak/papers/${t5Only}`)).status).toBe(200)

      await setGrade(9)
      expect(await listed()).not.toContain(both)

      const rows = List.parse((await admin.get('/api/admin/papers?pageSize=100')).body).data
      const row = rows.find((r) => r.id === t5Only)!
      expect(row.levelScope).toBe('t5')
      expect(row.origins?.reduce((n, o) => n + o.count, 0)).toBeGreaterThan(0)
      await setGrade(11)
    })

    it('a paper with no stored scope stays visible to every pupil (older than the decision)', async () => {
      const id = await generated()
      expect((await publish(id)).ok).toBe(true)
      await t.db.query(`update papers set level_scope = null where id = $1`, [id])
      await setGrade(8)
      expect(await listed()).toContain(id)
      expect((await editor(id)).paper.levelScope).toBeNull()
      await setGrade(11)
    })
  })

  describe('Bank panel (FR-ADM-Q14.4, 14-01, 14-02)', () => {
    let paper: string
    let sectionA: string
    let sectionC: string
    beforeAll(async () => {
      paper = (await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })).body.data.id as string
      const e = await editor(paper)
      sectionA = e.paper.sections[0]!.id
      sectionC = e.paper.sections[2]!.id
    })
    const bankOf = async (section: string, query = '') => {
      const res = await admin.get(`/api/admin/papers/${paper}/sections/${section}/pool?pageSize=100${query}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return Pool.parse(res.body)
    }

    it('a question with no key is not offered and the total does not count it; a reason of the section stays listed', async () => {
      const all = await bankOf(sectionC)
      expect(all.data.flatMap((u) => u.questionIds)).not.toContain(ids.noKey)
      expect(all.meta.totalItems).toBe(all.data.length)
      expect(all.data.some((u) => !u.eligible && u.reasons.length > 0)).toBe(true) // the pool tag of another Bahagian
    })

    it('Tahun takes one year, Negeri several; a group is one unit; the filter values come along', async () => {
      expect((await bankOf(sectionA, '&tahun=2024')).data.flatMap((u) => u.questionIds)).toEqual(expect.arrayContaining(['720003', '720004']))
      expect((await bankOf(sectionA, '&tahun=2024')).meta.totalItems).toBe(2)
      expect((await bankOf(sectionC, '&negeri=Kedah&negeri=mrsm')).meta.totalItems).toBe(2)
      const group = (await bankOf(sectionA, '&negeri=SBP')).data
      expect(group).toHaveLength(1)
      expect(group[0]).toMatchObject({ groupId: GROUP, questionIds: ids.g })
      expect((await bankOf(sectionA, '&tahun=2019')).data).toEqual([])
      expect((await bankOf(sectionA, '&tahun=2019')).filters.years).toEqual([2025, 2024, 2023])
      expectError(await admin.get(`/api/admin/papers/${paper}/sections/${sectionA}/pool?tahun=abc`), 'VALIDATION_ERROR', 422)
    })
  })

  describe('Chips (API-BIJAK-10 (g), FR-ADM-Q14.7, AC-ADM-Q14.3)', () => {
    it('a draft member that is archived reads not servable with the reason and blocks Terbit; a Terbit paper reads pinned and servable', async () => {
      const id = await generated()
      const first = await editor(id)
      expect(first.questions.filter((q) => q.servable !== undefined).every((q) => q.servable === true && q.pinned === false)).toBe(true)
      const target = first.paper.sections[1]!.questionIds[0]!
      expect(first.questions.find((q) => q.id === target)?.notServedReason).toBeUndefined()
      bank.setStatus(target, 'archived')
      try {
        const q = (await editor(id)).questions.find((x) => x.id === target)!
        expect(q.servable).toBe(false)
        expect(q.notServedReason).toBeTruthy()
        expect((await review(id)).canOverride).toBe(false)
      } finally {
        bank.setStatus(target, 'approved')
      }
      expect((await publish(id)).ok).toBe(true)
      bank.setStatus(target, 'archived')
      try {
        const q = (await editor(id)).questions.find((x) => x.id === target)!
        expect(q).toMatchObject({ pinned: true, servable: true })
      } finally {
        bank.setStatus(target, 'approved')
      }
    })
  })

  describe('FR-QA-41, paper side (AC-QA-41)', () => {
    const fresh = async () => {
      const id = (await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })).body.data.id as string
      const e = await editor(id)
      return { id, a: e.paper.sections[0]!.id, b: e.paper.sections[1]!.id, c: e.paper.sections[2]!.id }
    }
    const blockerOf = async (id: string, code: string) => (await review(id)).blockerDetails.filter((b) => b.code === code)

    it('Wajib dijawab and Pilih N exclude each other, whichever is set second', async () => {
      const { id, b } = await fresh()
      const text = 'Bahagian wajib dijawab tidak boleh digabungkan dengan Pilih N.'
      expect((await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: b, compulsory: true }] })).status).toBe(200)
      const refused = expectError(await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: b, rule: { type: 'choose', n: 1 } }] }), 'VALIDATION_ERROR', 422)
      expect(refused.message).toBe(text)
      expect(refused.fields).toEqual({ rule: text })
      const { id: other, c } = await fresh()
      // Bahagian C of this contract is Pilih N already.
      expect(expectError(await admin.put(`/api/admin/papers/${other}`, { sections: [{ id: c, compulsory: true }] }), 'VALIDATION_ERROR', 422).message).toBe(text)
      // A row written before the rule is a hard blocker at Terbit.
      await t.db.query(`update paper_sections set compulsory = true where id = $1`, [c])
      expect(await blockerOf(other, 'COMPULSORY_CHOOSE')).toEqual([expect.objectContaining({ message: text, overridable: false, section: 'Bahagian C' })])
    })

    it('a group is ONE choice unit: it counts once toward N and its marks are the sum of its members', async () => {
      // Bahagian C: Pilih 1 of 2, budget 2. A group of two 1-mark members is one unit worth 2.
      const { id, a, b, c } = await fresh()
      const put = await admin.put(`/api/admin/papers/${id}`, {
        sections: [
          { id: a, questionIds: ['720001', '720002', '720003'] },
          { id: b, questionIds: ['720011'] },
          { id: c, questionIds: ids.g },
        ],
      })
      expect(put.status, JSON.stringify(put.body)).toBe(200)
      const check = await review(id)
      // Marks 2 of the budget 2: the group is ranked as a whole, and N = 1 of 1 unit.
      expect(check.blockers.filter((l) => l.includes('Markah'))).toEqual([])
      expect(check.totalMarks).toBe(check.totalBudget)
      expect((await admin.get(`/api/admin/papers/${id}/student-view`)).body.data.sections[2].marks).toBe(2)
      // N = 2 cannot be met by one unit, though the section holds two questions.
      await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: c, rule: { type: 'choose', n: 2 } }] })
      expect((await blockerOf(id, 'RULE_N_EXCEEDS_QUESTIONS')).map((x) => x.message)).toEqual([`Bahagian C: ${LINES.ruleExceeds(2, 1)}`])
    })

    it('in an admin-added Bahagian N is capped by the units placed', async () => {
      const { id } = await fresh()
      const added = await admin.post(`/api/admin/papers/${id}/sections`, { label: 'Bahagian D' })
      const d = (added.body.data.paper.sections as { id: string; label: string }[]).find((s) => s.label === 'Bahagian D')!.id
      expect((await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: d, questionIds: [...ids.g, '720001'] }] })).status).toBe(200)
      const over = expectError(await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: d, rule: { type: 'choose', n: 3 } }] }), 'VALIDATION_ERROR', 422)
      expect(over.fields).toEqual({ rule: 'Nombor N tidak sah.' })
      expect((await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: d, rule: { type: 'choose', n: 2 } }] })).status).toBe(200)
    })

    it('unequal marks across units are refused at Terbit, and no override lifts it', async () => {
      await setContract(NOT_SERVING)
      try {
        const { id, a, b, c } = await fresh()
        await admin.put(`/api/admin/papers/${id}`, {
          sections: [
            { id: a, questionIds: ['720001', '720002', '720003'] },
            { id: b, questionIds: ['720011'] },
            { id: c, questionIds: ['720021', '720041'] }, // 2 and 3 marks
          ],
        })
        const lines = await blockerOf(id, 'CHOICE_UNITS_UNEQUAL')
        expect(lines).toEqual([expect.objectContaining({ message: 'Bahagian C: Markah antara unit mesti sama.', overridable: false })])
        expect((await publish(id, { override: true, reason: 'cuba paksa' })).ok).toBe(false)
      } finally {
        await setContract(SERVING)
      }
    })
  })

  describe('Terbit marks check (S3-T01 decision 15)', () => {
    const fullPaper = async () => {
      const id = (await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })).body.data.id as string
      const e = await editor(id)
      await admin.put(`/api/admin/papers/${id}`, {
        sections: [
          { id: e.paper.sections[0]!.id, questionIds: ['720001', '720002', '720003'] },
          { id: e.paper.sections[1]!.id, questionIds: ['720011'] },
          { id: e.paper.sections[2]!.id, questionIds: ['720021', '720022'] },
        ],
      })
      return id
    }
    const setMarks = (position: number, list: string | null) =>
      t.db.query(
        `update blueprint_sections set marks_per_question = $1::jsonb where position = $2 and blueprint_id = (select id from blueprints where code = '1449/2' and status = 'active')`,
        [list, position],
      )

    it('names the question by its number across Bahagian; hard under a Disahkan contract, overridable under a Spec one', async () => {
      await setMarks(1, '[1, 2, 1]')
      try {
        const id = await fullPaper()
        const hard = await review(id)
        expect(hard.blockerDetails).toEqual([expect.objectContaining({ code: 'MARKS_NOT_IN_CONTRACT', message: 'Markah soalan 2 tidak sepadan dengan kontrak.', overridable: false, section: 'Bahagian A', questionId: '720002' })])
        expect(hard.canOverride).toBe(false)
        expect((await publish(id, { override: true, reason: 'cuba paksa' })).ok).toBe(false)

        await setContract(NOT_SERVING)
        const soft = await review(id)
        expect(soft.blockerDetails.find((b) => b.code === 'MARKS_NOT_IN_CONTRACT')).toMatchObject({ overridable: true })
        expect(soft.canOverride).toBe(true)
        const done = await publish(id, { override: true, reason: 'kertas contoh' })
        expect(done.ok).toBe(true)
        expect(done.overridden).toContain('Markah soalan 2 tidak sepadan dengan kontrak.')
      } finally {
        await setContract(SERVING)
        await setMarks(1, null)
      }
    })

    it('a list that matches, and a scaled set of another size, raise nothing', async () => {
      await setMarks(1, '[1, 1, 1]')
      try {
        expect((await review(await fullPaper())).blockers).toEqual([])
        await setMarks(1, '[1, 2, 1]')
        expect((await review(await generated({ count: 3 }))).blockers).toEqual([])
      } finally {
        await setMarks(1, null)
      }
    })
  })
})
