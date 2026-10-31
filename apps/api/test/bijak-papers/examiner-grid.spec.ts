/**
 * AC-20.3 (T52): the cover carries `examinerGrid`, the flag behind the "Untuk Kegunaan Pemeriksa" block of the V2 cover
 * (docs/requirements/v2-admin-student-pipeline.md AC-20.3: "the examiner grid ... only when the paper has any non-auto-marked
 * part"). True when a placed question has a part whose scheme is mark-scheme points or a rubric (a person marks it); false for
 * an all-objective paper. The rule is judged here against the PoC mark schemes, not against the code under test.
 */
import { BijakPaperCoverSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { POC_BANK, pocQuestionId, type PocPart } from '../../src/modules/bijak/papers/poc'
import { infoOf } from '../../src/modules/bijak/question-bridge/be09-mapping'
import { loginAs, bootPapersApp, serveSeededBlueprints, setPocMarkBudgets, type Client, type PapersTestApp } from './helpers'

const kindOf = new Map(POC_BANK.schemes.map((s) => [s.id, s.scheme.kind]))
const leafIds = (parts: readonly PocPart[]): string[] => parts.flatMap((p) => (p.children?.length ? leafIds(p.children) : [p.id]))
const isManual = (key: string): boolean => {
  const q = POC_BANK.questions.find((x) => x.id === key)!
  return [q.id, ...leafIds(q.parts ?? [])].some((k) => ['points', 'rubric'].includes(kindOf.get(k) ?? ''))
}

let t: PapersTestApp
let student: Client
beforeAll(async () => {
  t = await bootPapersApp()
  await setPocMarkBudgets(t.db)
  await serveSeededBlueprints(t.db)
  student = await loginAs(t, 'pelajar@demo.test')
})
afterAll(async () => {
  await t.close()
})

const cover = async (id: string) => envelopeOf(BijakPaperCoverSchema).parse((await student.get(`/api/bijak/papers/${id}`)).body).data
async function paperIdOfCode(code: string, kertas: number): Promise<string> {
  const list = (await student.get('/api/bijak/papers')).body.data as { id: string; code: string; kertas: number }[]
  return list.find((p) => p.code === code && p.kertas === kertas)!.id
}

describe('examinerGrid on the cover (AC-20.3)', () => {
  it('a Kertas 1 paper of objective questions only: false', async () => {
    const c = await cover(await paperIdOfCode('1449/1', 1))
    // the premise: every placed question of this paper is an MCQ with an option scheme
    const placed = await t.db.query<{ question_id: string }>(`select pl.question_id::text from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [c.id])
    const manualKeys = POC_BANK.questions.filter((q) => placed.some((p) => p.question_id === pocQuestionId(q.id).toString())).filter((q) => isManual(q.id))
    expect(placed.length).toBeGreaterThan(0)
    expect(manualKeys).toEqual([])
    expect(c.examinerGrid).toBe(false)
  })

  it.each([['1449/2', 2], ['4541/2', 2], ['1249/2', 2]])('the structured paper %s (Kertas %i): true when a placed question has a points or rubric part', async (code, kertas) => {
    const id = await paperIdOfCode(code, kertas)
    const c = await cover(id)
    const placed = await t.db.query<{ question_id: string }>(`select pl.question_id::text from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [id])
    const expected = POC_BANK.questions.some((q) => placed.some((p) => p.question_id === pocQuestionId(q.id).toString()) && isManual(q.id))
    expect(c.examinerGrid).toBe(expected)
    expect(expected).toBe(true)
  })

  it('a Jana Kertas cover carries it too, from the questions it was composed of', async () => {
    const gen = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 2 })
    expect(gen.status, JSON.stringify(gen.body)).toBe(201)
    const id = (gen.body as { data: { paperId: string } }).data.paperId
    const placed = await t.db.query<{ question_id: string }>(`select pl.question_id::text from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [id])
    const expected = POC_BANK.questions.some((q) => placed.some((p) => p.question_id === pocQuestionId(q.id).toString()) && isManual(q.id))
    const c = await cover(id)
    expect(c.kind).toBe('jana')
    expect(c.examinerGrid).toBe(expected)
    expect(typeof c.examinerGrid).toBe('boolean')
  })
})

describe('infoOf (the BE-09 bridge): manual follows the scheme kinds', () => {
  const bundle = (schemes: Record<string, { kind: string; marks: number }>, mcq: boolean) =>
    ({ question: { id: 'q1', mcq }, schemes, versionNo: 3 }) as unknown as Parameters<typeof infoOf>[0]

  it('option, mapping and accepted parts are automatic: no flag', () => {
    expect(infoOf(bundle({ q1: { kind: 'option', marks: 1 } }, true), null).manual).toBeUndefined()
    expect(infoOf(bundle({ a: { kind: 'accepted', marks: 1 }, b: { kind: 'mapping', marks: 1 } }, false), null).manual).toBeUndefined()
  })

  it('a points or rubric part makes the question manual, even beside automatic parts', () => {
    expect(infoOf(bundle({ a: { kind: 'accepted', marks: 1 }, b: { kind: 'points', marks: 2 } }, false), null).manual).toBe(true)
    expect(infoOf(bundle({ a: { kind: 'rubric', marks: 10 } }, false), null).manual).toBe(true)
  })
})
