import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * R008-L1: a Guru may not link just any stimulus id to their own question. A stimulus picture is read through the questions that use it, so
 * a free link would let a teacher read another author's draft figure by its token. Only the stimuli the stored version already carries stay;
 * the admin may link any stimulus of the library. The refusal is the same 422 as an unknown stimulus.
 */
describe('a Guru cannot link an arbitrary stimulus to their question (R008-L1)', () => {
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

  const stimulus = async (): Promise<string> => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan penulis lain', body: { ms: 'Teks petikan draf.' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const leaf = (stimulusId?: string) => ({
    label: '',
    marks: 1,
    mode: 'mcq',
    key: { kind: 'option', correct: 'A' },
    prompt: { ms: 'Pilih jawapan yang betul.' },
    options: [
      { label: 'A', body: { ms: 'Satu' } },
      { label: 'B', body: { ms: 'Dua' } },
      { label: 'C', body: { ms: 'Tiga' } },
    ],
    ...(stimulusId === undefined ? {} : { stimulusId }),
  })
  const guruBody = (parts?: unknown[]) => ({
    questionType: 'mcq',
    questionText: 'Soalan guru dengan petikan?',
    subjectId: refs.mathId,
    educationLevelId: refs.t4Id,
    difficultyLevel: 3,
    options: ['1', '2', '3', '4'],
    correctAnswer: 1,
    ...(parts === undefined ? {} : { parts }),
  })

  it('creating with a part stimulus of someone else is 422 "Stimulus tidak sah." (as an unknown id); nothing is stored', async () => {
    const sid = await stimulus()
    const before = Number((await t.db.query<{ n: string }>('select count(*) n from questions'))[0]!.n)
    for (const id of [sid, '987654321']) {
      const res = await teacher.post('/api/guru/questions', guruBody([leaf(id)]))
      expect(res.status, id).toBe(422)
      expect(res.body.error.fields.parts, id).toBe('Stimulus tidak sah.')
    }
    expect(Number((await t.db.query<{ n: string }>('select count(*) n from questions'))[0]!.n)).toBe(before)
  })

  it('editing an own question: a body with another stimulus is refused or ignored, and never stored as a link', async () => {
    const created = await teacher.post('/api/guru/questions', guruBody())
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.data.id as string
    const other = await stimulus()
    const res = await teacher.put(`/api/guru/questions/${id}`, { questionText: 'Soalan guru yang disunting?', parts: [leaf(other)] })
    expect([200, 422], JSON.stringify(res.body)).toContain(res.status)
    const linked = await t.db.query(
      `select 1 from question_version_stimuli l join question_versions v on v.id = l.question_version_id where v.question_id = $1 and l.stimulus_id = $2
       union all select 1 from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1 and p.stimulus_id = $2`,
      [id, other],
    )
    expect(linked).toEqual([])
    // the stimulus the stored version already carries is kept through an edit (owner side), the admin side links it freely
    const own = await stimulus()
    const version = (await t.db.query<{ id: string }>(`select id::text id from question_versions where question_id = $1 order by version_no desc limit 1`, [id]))[0]!.id
    await t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 1)`, [version, own])
    expect((await teacher.put(`/api/guru/questions/${id}`, { questionText: 'Soalan guru dengan petikan sendiri yang disunting?' })).status).toBe(200)
  })

  it('the admin may link any stimulus of the library to a question', async () => {
    const sid = await stimulus()
    const res = await admin.post('/api/questions', { ...mcqBody(refs), parts: [leaf(sid)] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })
})
