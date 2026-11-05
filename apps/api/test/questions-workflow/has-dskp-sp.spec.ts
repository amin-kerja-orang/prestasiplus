import { QuestionGateCheckSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * S4-T09 (ruling on #453, D115, FR-ADM-C04.4, QE4.6): "DSKP nodes exist" for the gate means SP nodes exist (`curriculum_nodes.kind = 'sp'`).
 * A Subjek + Tingkatan with only Bab (`unit`) nodes does not switch on the unit, SP and TP items; one with SP nodes still does. Real bank, real routes.
 */
describe('S4-T09: has_dskp counts SP nodes only', () => {
  let t: WorkflowTestApp
  let admin: Client
  let repo: QuestionsRepository
  let seeded: { subjectId: string; levelId: string }
  let unitOnly: { subjectId: string; levelId: string }

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    admin = (await loginAll(t)).admin
    repo = t.app.get(QuestionsRepository)
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string }>(
      `select subject_id::text, education_level_id::text from question_versions where number_label = 'SEED-MCQ-MATH-T4'`,
    )
    seeded = { subjectId: row!.subject_id, levelId: row!.education_level_id }
    // A fresh subject at the same level whose only DSKP nodes are Bab (`unit`) nodes: no `sk`, no `sp`.
    const [subject] = await t.db.query<{ id: string }>(`insert into subjects (code, name, name_en, color) values ('S4T09', 'Subjek S4-T09', 'Subject S4-T09', '#336699') returning id::text`)
    await t.db.query(`insert into subject_levels (subject_id, education_level_id) values ($1::bigint, $2::bigint)`, [subject!.id, seeded.levelId])
    await t.db.query(
      `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition) values ($1::bigint, $2::bigint, 'unit', '1', 'Bab 1', 'S4T09')`,
      [subject!.id, seeded.levelId],
    )
    unitOnly = { subjectId: subject!.id, levelId: seeded.levelId }
  })
  afterAll(async () => {
    await t.close()
  })

  const draft = async (subjectId: string, levelId: string): Promise<string> => {
    const res = await admin.post('/api/questions', {
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah dua dan tiga?',
      subjectId,
      educationLevelId: levelId,
      difficultyLevel: 2,
      cognitiveLevel: 'mengaplikasi',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      status: 'review',
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const codes = async (id: string) =>
    envelopeOf(QuestionGateCheckSchema).parse((await admin.get(`/api/questions/${id}/gate-check?gate=approve`)).body).data.issues.map((i) => i.code)

  it('unit-only subject and level: curriculumFactsFor reports no DSKP nodes', async () => {
    expect((await repo.curriculumFactsFor(unitOnly.subjectId, unitOnly.levelId)).hasDskpNodes).toBe(false)
  })

  it('SP nodes exist: curriculumFactsFor reports DSKP nodes', async () => {
    expect((await repo.curriculumFactsFor(seeded.subjectId, seeded.levelId)).hasDskpNodes).toBe(true)
  })

  it('unit-only subject and level: gateFacts has hasDskpNodes false and a question without SP or TP can be approved', async () => {
    const id = await draft(unitOnly.subjectId, unitOnly.levelId)
    const [v] = await t.db.query<{ version_no: number }>(`select version_no from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id])
    expect((await repo.gateFacts(id, v!.version_no)).hasDskpNodes).toBe(false)
    expect(await codes(id)).not.toEqual(expect.arrayContaining(['NO_UNIT']))
    expect(await codes(id)).not.toEqual(expect.arrayContaining(['NO_SP']))
    expect(await codes(id)).not.toEqual(expect.arrayContaining(['TP_MISSING']))
    const res = await admin.post(`/api/questions/${id}/status`, { to: 'approved' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
  })

  it('SP nodes exist: gateFacts has hasDskpNodes true and SP and TP are still required (T4/T5 unchanged)', async () => {
    const id = await draft(seeded.subjectId, seeded.levelId)
    const [v] = await t.db.query<{ version_no: number }>(`select version_no from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id])
    expect((await repo.gateFacts(id, v!.version_no)).hasDskpNodes).toBe(true)
    expect(await codes(id)).toEqual(expect.arrayContaining(['NO_UNIT', 'NO_SP']))
    const res = await admin.post(`/api/questions/${id}/status`, { to: 'approved' })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
  })
})
