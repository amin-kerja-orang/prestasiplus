import { QuestionDetailSchema, QuestionGuruDetailSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * R1-T45b / PIPE AC-04.4: the Admin Pusat question detail lists the curated papers that place the question (title, status, section, pinned
 * version) so the admin sees where it is used before editing or archiving. Every paper status and every pinned version is listed, published
 * first; generated (Jana) papers are counted, not listed. The Guru and student views never gain the field.
 */
describe('question detail lists the papers that place it (AC-04.4)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let refs: Refs

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  async function paper(title: string, status: string, placements: { questionId: string; section: string; pinned: number }[], kind = 'pilihan'): Promise<string> {
    const userId = kind === 'jana' ? (await t.db.query<{ id: string }>(`select id::text id from users where lower(email) = 'pelajar@demo.test'`))[0]!.id : null
    const p = (
      await t.db.query<{ id: string }>(
        `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, generated_for_user_id) values ($1, $2, $3, 1, 60, $4, $5) returning id::text id`,
        [kind, title, refs.mathId, status, userId],
      )
    )[0]!.id
    let position = 0
    for (const pl of placements) {
      const s = (await t.db.query<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, $2, $3, 1, 0) returning id::text id`, [p, ++position, pl.section]))[0]!.id
      await t.db.query(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, $3, 1)`, [s, pl.questionId, pl.pinned])
    }
    return p
  }

  it('lists every curated paper that places the question, published first, with section and pinned version; Jana papers are counted', async () => {
    const q = (await admin.post('/api/questions', mcqBody(refs))).body.data.id as string
    const other = (await admin.post('/api/questions', mcqBody(refs))).body.data.id as string
    const draft = await paper('Kertas draf', 'draft', [{ questionId: q, section: 'Bahagian A', pinned: 1 }])
    const published = await paper('Kertas diterbitkan', 'published', [{ questionId: q, section: 'Bahagian B', pinned: 2 }])
    const withdrawn = await paper('Kertas ditarik', 'withdrawn', [{ questionId: q, section: 'Bahagian A', pinned: 1 }])
    await paper('Kertas lain', 'published', [{ questionId: other, section: 'Bahagian A', pinned: 1 }])
    await paper('Kertas jana murid', 'published', [{ questionId: q, section: 'Bahagian A', pinned: 1 }], 'jana')

    const res = await admin.get(`/api/questions/${q}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const detail = envelopeOf(QuestionDetailSchema).parse(res.body).data
    expect(detail.placements).toEqual([
      { paperId: published, title: 'Kertas diterbitkan', status: 'published', section: 'Bahagian B', versionNo: 2 },
      { paperId: withdrawn, title: 'Kertas ditarik', status: 'withdrawn', section: 'Bahagian A', versionNo: 1 },
      { paperId: draft, title: 'Kertas draf', status: 'draft', section: 'Bahagian A', versionNo: 1 },
    ])
    expect(detail.generatedPaperCount).toBe(1)
  })

  it('a question on no paper has an empty list and a zero count', async () => {
    const q = (await admin.post('/api/questions', mcqBody(refs))).body.data.id as string
    const detail = envelopeOf(QuestionDetailSchema).parse((await admin.get(`/api/questions/${q}`)).body).data
    expect(detail.placements).toEqual([])
    expect(detail.generatedPaperCount).toBe(0)
  })

  it('the Guru view of the same question never carries the papers, and a Guru cannot open the admin detail', async () => {
    const own = await teacher.post('/api/guru/questions', { questionType: 'mcq', questionText: 'Soalan guru untuk ujian kertas?', options: ['1', '2', '3', '4'], correctAnswer: 1, subjectId: refs.mathId, educationLevelId: refs.t4Id, difficultyLevel: 3 })
    expect(own.status, JSON.stringify(own.body)).toBe(201)
    const id = own.body.data.id as string
    await paper('Kertas guru', 'published', [{ questionId: id, section: 'Bahagian A', pinned: 1 }])
    const view = await teacher.get(`/api/guru/questions/${id}`)
    expect(view.status).toBe(200)
    expect(JSON.stringify(view.body)).not.toMatch(/placements|generatedPaperCount|Kertas guru/)
    void QuestionGuruDetailSchema
    expectError(await teacher.get(`/api/questions/${id}`), 'FORBIDDEN')
  })
})
