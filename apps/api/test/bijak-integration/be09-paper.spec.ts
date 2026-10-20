/**
 * Bijak attempts on REAL BE-09 questions (#45 C2, M8): a paper whose placements point at question-bank ids
 * (seeded by the BE-09 seed, written into BE-15's tables by the test) is started, answered, graded and
 * submitted through the real `BijakIntegrationModule` wiring and the BE-09 -> exam-core bridge.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BijakAttemptPaperViewSchema, BijakAttemptResultViewSchema } from '@pp/contract'

import { Be09BijakQuestionSource } from '../../src/modules/bijak/question-bridge'
import { QuestionsService } from '../../src/modules/questions'
import {
  bootIntegrationApp,
  type Client,
  type IntegrationApp,
  loginAs,
  START,
  STUDENT,
} from './helpers'

let t: IntegrationApp
let student: Client
const ids = new Map<string, string>()

const id = (ref: string): string => {
  const v = ids.get(ref)
  if (!v) throw new Error(`seed question ${ref} not found`)
  return v
}

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
  const rows = await t.db.query<{ id: string; ref: string }>(
    `select q.id::text as id, v.number_label as ref from questions q
     join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
     where v.number_label like 'SEED-%'`,
  )
  for (const r of rows) ids.set(r.ref, r.id)
})
afterAll(async () => {
  await t.close()
})

/** Writes a published pilihan paper with one section per entry straight into BE-15's tables. */
async function createPaper(
  title: string,
  sections: { label: string; questionIds: string[] }[],
): Promise<string> {
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: 'pilihan',
      title,
      subjectId: subject.id,
      kertas: 2,
      paperCode: '1449/2',
      printedDurationMin: 60,
      status: 'published',
      publishedAt: new Date(START),
      sections: {
        create: sections.map((s, i) => ({
          position: i + 1,
          label: s.label,
          questionCount: s.questionIds.length,
          markBudget: 0,
          placements: {
            create: s.questionIds.map((q, j) => ({ questionId: BigInt(q), position: j + 1 })),
          },
        })),
      },
    },
  })
  return paper.id.toString()
}

const save = (attemptId: string, changes: { partId: string; answer: Record<string, unknown> }[]) =>
  student.put(`/api/bijak/attempts/${attemptId}/answers`, {
    changes: changes.map((c) => ({ ...c, rev: 1, savedAt: t.clock.now().toISOString() })),
  })

describe('a paper built from BE-09 questions', () => {
  let paperId = ''
  let attemptId = ''

  it('1. the seeded bank questions map: the bridge serves them at their live version', async () => {
    const source = t.app.get(Be09BijakQuestionSource)
    const wanted = [
      'SEED-MCQ-MATH-T4',
      'SEED-STR-ECF',
      'SEED-STR-TREE',
      'SEED-STR-ANYN',
      'SEED-GRP-AYAT-1',
      'SEED-GRP-PASAR-1',
    ]
    const versions = await source.versionsOf(wanted.map(id))
    for (const ref of wanted) expect(versions.get(id(ref)), ref).toBe(1)
    // Every published seed question maps (none needs a refused feature); the bundles and the BE-15 info agree.
    const all = [...ids.values()]
    expect((await source.loadQuestions(all)).size).toBe(all.length)
    const info = await source.getMany([id('SEED-STR-ECF'), id('SEED-GRP-AYAT-1')])
    expect(info.get(id('SEED-STR-ECF'))).toMatchObject({ marks: 4, groupId: null, versionNo: 1 })
    expect(info.get(id('SEED-GRP-AYAT-1'))?.groupId).toMatch(/^qb-g\d+$/)
    // A draft (no live version) is never served.
    expect(ids.has('SEED-DRAFT-BM-T4')).toBe(false)
  })

  it('2. starts: the served paper carries the mapped questions and no key', async () => {
    paperId = await createPaper('Kertas ujian bank soalan', [
      {
        label: 'Bahagian A',
        questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-GRP-AYAT-1'), id('SEED-GRP-AYAT-2')],
      },
      { label: 'Bahagian B', questionIds: [id('SEED-STR-ECF'), id('SEED-STR-ANYN')] },
    ])
    const res = await student.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
    attemptId = (res.body as { data: { attemptId: string } }).data.attemptId
    const v = await student.get(`/api/bijak/attempts/${attemptId}`)
    expect(v.status, JSON.stringify(v.body)).toBe(200)
    const raw = JSON.stringify(v.body)
    for (const k of [
      'correct',
      'scheme',
      'correctOption',
      'accept',
      'points',
      'rubric',
      'values',
      'final',
      'map',
      'model',
      'modelText',
      'reason',
      'key',
    ])
      expect(raw).not.toContain(`"${k}"`)
    const view = BijakAttemptPaperViewSchema.parse(v.body.data)
    expect(view.questions.map((q) => q.id)).toEqual([
      id('SEED-MCQ-MATH-T4'),
      id('SEED-GRP-AYAT-1'),
      id('SEED-GRP-AYAT-2'),
      id('SEED-STR-ECF'),
      id('SEED-STR-ANYN'),
    ])
    const mcq = view.questions[0]!
    expect(mcq.mcq?.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D'])
    const ecf = view.questions[3]!
    expect(ecf.parts?.map((p) => p.id)).toEqual([
      `${id('SEED-STR-ECF')}.a`,
      `${id('SEED-STR-ECF')}.b`,
    ])
    // The match items share the group passage and the lettered bank.
    expect(view.questions[1]!.optionBank?.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(view.groups).toHaveLength(1)
    expect(view.groups[0]!.questionIds).toEqual([id('SEED-GRP-AYAT-1'), id('SEED-GRP-AYAT-2')])
  })

  it('3. autosaves, submits and grades with the BE-09 keys (MCQ, match letter, numeric, working with ECF)', async () => {
    const ecf = id('SEED-STR-ECF')
    const keyOf = async (ref: string): Promise<string> => {
      const rows = await t.db.query<{ map: Record<string, string> }>(
        `select k.content->'map' as map from answer_keys k join question_parts p on p.id = k.part_id
         join question_versions v on v.id = p.question_version_id where v.number_label = $1`,
        [ref],
      )
      return Object.values(rows[0]!.map)[0]!
    }
    const letter1 = await keyOf('SEED-GRP-AYAT-1')
    const key2 = await keyOf('SEED-GRP-AYAT-2')
    const wrong2 = ['A', 'B', 'C', 'D'].find((l) => l !== key2)!
    const saved = await save(attemptId, [
      { partId: id('SEED-MCQ-MATH-T4'), answer: { choice: 'B' } },
      { partId: `${id('SEED-GRP-AYAT-1')}.1`, answer: { choice: letter1 } },
      { partId: `${id('SEED-GRP-AYAT-2')}.2`, answer: { choice: wrong2 } },
      { partId: `${ecf}.a`, answer: { final: '5', unit: 'cm' } },
      { partId: `${ecf}.b`, answer: { steps: ['3 + 4 + 5'], final: '12', unit: 'cm' } },
      {
        partId: `${id('SEED-STR-ANYN')}.a`,
        answer: { text: 'Memakai kot makmal dan gogal keselamatan.' },
      },
    ])
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    t.clock.set(new Date(new Date(START).getTime() + 600_000).toISOString())
    const sub = await student.post(`/api/bijak/attempts/${attemptId}/submit`, {
      idempotencyKey: 'be09-paper-1',
      changes: [],
    })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)

    const r = await student.get(`/api/bijak/attempts/${attemptId}/result`)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    const { result, attempt } = BijakAttemptResultViewSchema.parse(r.body.data)
    expect(attempt.status).toBe('submitted')
    const byId = new Map(result.questions.map((q) => [q.questionId, q]))
    expect(byId.get(id('SEED-MCQ-MATH-T4'))).toMatchObject({ marks: 1, awarded: 1 })
    expect(byId.get(id('SEED-GRP-AYAT-1'))).toMatchObject({ marks: 1, awarded: 1 })
    // The second match item was answered with a wrong letter on purpose.
    expect(byId.get(id('SEED-GRP-AYAT-2'))).toMatchObject({ marks: 1, awarded: 0 })
    expect(byId.get(ecf)).toMatchObject({ marks: 4, awarded: 4 })
    // The answered essay (points without accept = manual) waits for a teacher: 0 now, result provisional.
    expect(byId.get(id('SEED-STR-ANYN'))).toMatchObject({ marks: 3, awarded: 0 })
    expect(result.provisional).toBe(true)
    expect(result.max).toBe(1 + 1 + 1 + 4 + 3)
    expect(result.score).toBe(1 + 1 + 0 + 4 + 0)
  })

  it('4. closes the loop: one aggregate row and one wallet credit for the attempt', async () => {
    const agg = await t.db.query(
      'select units_awarded, start_type, is_test from practice_attempt_aggregates where attempt_id = $1',
      [attemptId],
    )
    expect(agg).toHaveLength(1)
    expect(agg[0]).toMatchObject({ start_type: 'pilihan', is_test: false })
    expect(
      await t.db.query('select 1 from coin_ledger where source = $1 and source_id = $2', [
        'quiz_spm',
        attemptId,
      ]),
    ).toHaveLength(1)
  })

  it('5. a paper placing an id the bank does not serve is not eligible (403), never a half-built paper', async () => {
    const bad = await createPaper('Kertas ujian soalan tiada', [
      { label: 'Bahagian A', questionIds: [id('SEED-MCQ-MATH-T4'), '987654321'] },
    ])
    const res = await student.post('/api/bijak/attempts', { paperId: bad, mode: 'exam' })
    expect(res.status, JSON.stringify(res.body)).toBe(403)
  })

  it('6. a paper mixing PoC reserved ids and bank ids is served by both sources', async () => {
    const poc = (
      await t.db.query<{ qid: string }>(
        `select question_id::text as qid from paper_placements where question_id >= 9000000000 limit 1`,
      )
    )[0]!.qid
    const mixed = await createPaper('Kertas ujian campuran', [
      { label: 'Bahagian A', questionIds: [poc, id('SEED-MCQ-MATH-T4')] },
    ])
    const res = await student.post('/api/bijak/attempts', { paperId: mixed, mode: 'latihan' })
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
    const v = await student.get(
      `/api/bijak/attempts/${(res.body as { data: { attemptId: string } }).data.attemptId}`,
    )
    expect(v.status, JSON.stringify(v.body)).toBe(200)
    expect(BijakAttemptPaperViewSchema.parse(v.body.data).questions.map((q) => q.id)).toEqual([
      poc,
      id('SEED-MCQ-MATH-T4'),
    ])
  })

  it('7. withdrawing a placed question keeps its graded attempt readable, but a new start is not eligible', async () => {
    const qid = id('SEED-MCQ-MATH-T4')
    // Through BE-09's own service: published -> archived clears the live version (withdrawn).
    await t.app.get(QuestionsService).setStatus(qid, 'archived', '1')
    expect(
      (await t.db.query('select live_version_no from questions where id = $1', [qid]))[0],
    ).toEqual({ live_version_no: null })
    const r = await student.get(`/api/bijak/attempts/${attemptId}/result`)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(BijakAttemptResultViewSchema.parse(r.body.data).result.score).toBe(6)
    const res = await student.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(res.status, JSON.stringify(res.body)).toBe(403)
  })
})
