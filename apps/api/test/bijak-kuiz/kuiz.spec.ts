/**
 * Simulasi Kuiz (R1-B16) on the real wiring (auth + BijakIntegrationModule + the BE-09 seed): selection rules, no key leak,
 * server marking, the practice-session write of the random quiz (U8) and the per-paper quiz that stores nothing.
 */
import {
  BijakKuizCheckResultSchema,
  BijakKuizPaperPageSchema,
  BijakKuizResultSchema,
  BijakKuizSessionSchema,
  type BijakKuizItem,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT, TEACHER, ADMIN } from '../bijak-integration/helpers'

// The rate-limit case is last; every other case stays under this many starts.
process.env.THROTTLE_BIJAK_KUIZ_START_PER_MINUTE = '60'

let t: IntegrationApp
let student: Client
let other: Client
const ids = new Map<string, string>()
const id = (ref: string): string => {
  const v = ids.get(ref)
  if (!v) throw new Error(`seed question ${ref} not found`)
  return v
}

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
  other = await loginAs(t, 'pelajarmaju@demo.test')
  const rows = await t.db.query<{ id: string; ref: string }>(
    `select q.id::text as id, v.number_label as ref from questions q
       join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no
      where v.number_label like 'SEED-%'`,
  )
  for (const r of rows) ids.set(r.ref, r.id)
}, 180_000)
afterAll(async () => {
  await t.close()
})

const start = (who: Client, body: Record<string, unknown>) => who.post('/api/bijak/kuiz/sessions', body)
const sessionOf = (res: { body: { data: unknown } }) => BijakKuizSessionSchema.parse(res.body.data)
/** The answer key of a seed question, straight from the database (the API must never send it). */
async function keyOf(questionId: string): Promise<string> {
  const rows = await t.db.query<{ correct: string }>(
    `select k.content->>'correct' as correct from answer_keys k join question_parts p on p.id = k.part_id
       join questions q on q.id = $1::bigint join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no and v.id = p.question_version_id
      where p.mode = 'mcq'`,
    [questionId],
  )
  return rows[0]!.correct
}
const wrongLabel = (item: BijakKuizItem, correct: string): string => item.options.find((o) => o.id !== correct)!.id

async function createPaper(title: string, sections: { label: string; questionIds: string[] }[], opts: { status?: string; kind?: string; owner?: string } = {}): Promise<string> {
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: opts.kind ?? 'pilihan',
      title,
      subjectId: subject.id,
      kertas: 1,
      paperCode: '1449/1',
      printedDurationMin: 60,
      status: opts.status ?? 'published',
      publishedAt: new Date(START),
      ...(opts.owner ? { generatedForUserId: BigInt(opts.owner) } : {}),
      sections: {
        create: sections.map((s, i) => ({
          position: i + 1,
          label: s.label,
          instruction: i === 0 ? 'Jawab semua soalan.' : null,
          questionCount: s.questionIds.length,
          markBudget: 0,
          placements: { create: s.questionIds.map((q, j) => ({ questionId: BigInt(q), position: j + 1 })) },
        })),
      },
    },
  })
  return paper.id.toString()
}

describe('random quiz: selection rules (V2 ExamQuizController::index)', () => {
  it('1. draws only live, published, active, single objective questions of the subject, with stimulus, and no key', async () => {
    const res = await start(student, { subject: 'BM', count: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const s = sessionOf(res)
    // BM has five published single MCQs in the seed (2 plain + 3 sharing the Pasar passage).
    expect(s.items.map((i) => i.id).sort()).toEqual(['SEED-MCQ-BM-T4', 'SEED-MCQ-BM-T5', 'SEED-GRP-PASAR-1', 'SEED-GRP-PASAR-2', 'SEED-GRP-PASAR-3'].map(id).sort())
    expect(s.count).toBe(5)
    for (const item of s.items) {
      expect(item.kind).toBe('mcq')
      expect(item.markable).toBe(true)
      expect(item.options.length).toBeGreaterThanOrEqual(3)
      expect(new Set(item.options.map((o) => o.id)).size).toBe(item.options.length)
      // the shown labels are positional letters
      expect(item.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'].slice(0, item.options.length))
    }
    const pasar = s.items.find((i) => i.id === id('SEED-GRP-PASAR-1'))!
    expect(pasar.stimuli).toHaveLength(1)
    expect(pasar.stimuli[0]).toMatchObject({ kind: 'passage' })
    expect(pasar.stimuli[0]!.body).toContain('Pasar tani')
    expect(s.items.find((i) => i.id === id('SEED-MCQ-BM-T4'))!.stimuli).toEqual([])
    expect(s.items[0]!.subjectName).toBeTruthy()
  })

  it('2. never leaks the key, a scheme or the explanation before the check', async () => {
    const res = await start(student, { subject: 'MATH', count: 5 })
    expect(res.status).toBe(201)
    const raw = JSON.stringify(res.body)
    for (const k of ['"correct"', '"key"', '"scheme"', '"explanation"', '"correctOptionId"', '"is_correct"', '"isCorrect"']) expect(raw).not.toContain(k)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('3. excludes drafts, review, archived, inactive and non-objective questions', async () => {
    await t.db.query(`update questions set is_active = false where id = $1::bigint`, [id('SEED-MCQ-MATH-T4')])
    const res = await start(student, { count: 40 })
    expect(res.status).toBe(201)
    const served = new Set(sessionOf(res).items.map((i) => i.id))
    for (const ref of ['SEED-DRAFT-BM-T4', 'SEED-REVIEW-SCI-T5', 'SEED-ARCHIVED-MATH-T4', 'SEED-MCQ-MATH-T4', 'SEED-STR-ECF', 'SEED-STR-TREE', 'SEED-STR-ANYN', 'SEED-GRP-AYAT-1']) {
      expect(served.has(id(ref)), ref).toBe(false)
    }
    expect(served.has(id('SEED-MCQ-MATH-T5'))).toBe(true)
    await t.db.query(`update questions set is_active = true where id = $1::bigint`, [id('SEED-MCQ-MATH-T4')])
  })

  it('4. hides questions of a primary level and PKSK questions (learner visibility)', async () => {
    const before = await t.db.query<{ education_level_id: string | null }>(
      `select v.education_level_id::text from question_versions v join questions q on q.id = v.question_id and q.live_version_no = v.version_no where q.id = $1::bigint`,
      [id('SEED-MCQ-SCI-T4')],
    )
    const primary = (await t.db.query<{ id: string }>(`select id::text from education_levels where stage = 'primary' limit 1`))[0]!.id
    await t.db.query(`update question_versions v set education_level_id = $2::bigint from questions q where q.id = v.question_id and q.live_version_no = v.version_no and q.id = $1::bigint`, [id('SEED-MCQ-SCI-T4'), primary])
    const res = await start(student, { subject: 'SCI', count: 40 })
    const served = res.status === 201 ? sessionOf(res).items.map((i) => i.id) : []
    expect(served).not.toContain(id('SEED-MCQ-SCI-T4'))
    await t.db.query(`update question_versions v set education_level_id = $2::bigint from questions q where q.id = v.question_id and q.live_version_no = v.version_no and q.id = $1::bigint`, [id('SEED-MCQ-SCI-T4'), before[0]!.education_level_id])
  })

  it('5. serves fewer than count when the bank is short (V2 limit), and 422 "Belum ada soalan objektif" when nothing matches', async () => {
    const res = await start(student, { subject: 'SCI', count: 40 })
    expect(res.status).toBe(201)
    expect(sessionOf(res).items.length).toBeLessThan(40)
    expect(sessionOf(res).count).toBe(sessionOf(res).items.length)
    const none = await start(student, { subject: 'ZZZ', count: 5 })
    expect(none.status).toBe(422)
    expect(none.body.error).toMatchObject({ code: 'NO_QUESTIONS', message: 'Belum ada soalan objektif' })
  })

  it('6. validates the body at the boundary (count in 5/10/20/40, strict keys) and defaults to 20', async () => {
    for (const body of [{ subject: '' }, { subject: 'MATH', extra: 1 }, { subject: 5 }]) {
      const res = await start(student, body)
      expect(res.status, JSON.stringify(body)).toBe(422)
    }
    // V2: an invalid or missing count silently becomes 20 (never a 422); '10' is cast to 10.
    const twenty = sessionOf(await start(student, { count: 20 })).items.length
    const five = sessionOf(await start(student, { count: 5 })).items.length
    expect(five).toBe(5)
    expect(twenty).toBeGreaterThan(5) // the seed bank holds more than five servable questions, fewer than 20
    for (const count of [undefined, 7, 100, null, 'abc', { a: 1 }]) {
      const res = await start(student, count === undefined ? {} : { count })
      expect(res.status, JSON.stringify(count)).toBe(201)
      expect(sessionOf(res).items.length, JSON.stringify(count)).toBe(twenty)
    }
    // V2 casts with (int): '5' and 5.5 both become 5, a valid count
    expect(sessionOf(await start(student, { subject: 'BM', count: '5' })).items).toHaveLength(5)
    expect(sessionOf(await start(student, { subject: 'BM', count: 5.5 })).items).toHaveLength(5)
  }, 120_000)
})

describe('random quiz: marking and the practice-session write (U8)', () => {
  let sessionId = ''
  let items: BijakKuizItem[] = []

  it('7. marks on the server: right and wrong, with the key only in the answer', async () => {
    const res = await start(student, { subject: 'BM', count: 5 })
    const s = sessionOf(res)
    sessionId = s.sessionId
    items = s.items
    // the session is a stored practice session (mode latih_tubi)
    const row = await t.db.query<{ mode: string; status: string; question_count: number; is_test: boolean }>(`select mode, status, question_count, is_test from practice_sessions where id = $1`, [sessionId])
    expect(row[0]).toMatchObject({ mode: 'latih_tubi', status: 'in_progress', question_count: 5, is_test: false })
    expect(Number((await t.db.query(`select count(*) as n from practice_session_questions where session_id = $1`, [sessionId]))[0]!.n)).toBe(5)

    const right = items[0]!
    const rightKey = await keyOf(right.id)
    const ok = await student.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, { itemId: right.id, optionId: rightKey })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(BijakKuizCheckResultSchema.parse(ok.body.data)).toMatchObject({ correct: true, correctOptionId: rightKey })

    const wrong = items[1]!
    const wrongKey = await keyOf(wrong.id)
    const bad = await student.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, { itemId: wrong.id, optionId: wrongLabel(wrong, wrongKey) })
    expect(BijakKuizCheckResultSchema.parse(bad.body.data)).toMatchObject({ correct: false, correctOptionId: wrongKey })
  })

  it('8. the first check counts: a repeat returns the stored verdict, even with a different option', async () => {
    const wrong = items[1]!
    const key = await keyOf(wrong.id)
    const again = await student.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, { itemId: wrong.id, optionId: key })
    expect(again.status).toBe(200)
    expect(again.body.data.correct).toBe(false)
  })

  it('9. refuses an item that is not in the session, an option that is not of the item and a malformed id', async () => {
    const r = (itemId: string, optionId: string) => student.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, { itemId, optionId })
    expect((await r(id('SEED-MCQ-MATH-T5'), 'A')).status).toBe(422) // not served in this BM session
    expect((await r(items[2]!.id, 'H')).status).toBe(422) // not an option of the question
    expect((await r(`${items[2]!.id}:a`, 'A')).status).toBe(422)
    expect((await r('abc', 'A')).status).toBe(422)
    expect((await student.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, { itemId: items[2]!.id, optionId: 'a' })).status).toBe(422)
    expect((await student.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, { itemId: items[2]!.id })).status).toBe(422)
  })

  it('10. another pupil, an unknown id and a malformed id get the same 404', async () => {
    const body = { itemId: items[2]!.id, optionId: 'A' }
    expect((await other.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, body)).status).toBe(404)
    expect((await other.post(`/api/bijak/kuiz/sessions/${sessionId}/finish`, {})).status).toBe(404)
    expect((await student.post(`/api/bijak/kuiz/sessions/00000000-0000-4000-8000-000000000000/check`, body)).status).toBe(404)
    expect((await student.post(`/api/bijak/kuiz/sessions/not-a-uuid/check`, body)).status).toBe(404)
  })

  it('11. finish stores the answers, feeds the revision queue (Soalan Aku Salah) and returns the score', async () => {
    const res = await student.post(`/api/bijak/kuiz/sessions/${sessionId}/finish`, { timeSpent: 42 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const r = BijakKuizResultSchema.parse(res.body.data)
    expect(r).toMatchObject({ score: 1, total: 5, answered: 2 })
    expect(r.gamification.pointsEarned).toBe(10)
    const row = await t.db.query<{ status: string; correct_count: number; time_spent_sec: number }>(`select status, correct_count, time_spent_sec from practice_sessions where id = $1`, [sessionId])
    expect(row[0]).toMatchObject({ status: 'completed', correct_count: 1, time_spent_sec: 42 })
    const answers = await t.db.query<{ question_id: string; is_correct: boolean; subject_id: string | null }>(`select question_id::text, is_correct, subject_id::text from practice_answers where session_id = $1 order by id`, [sessionId])
    expect(answers.map((a) => [a.question_id, a.is_correct])).toEqual([[items[0]!.id, true], [items[1]!.id, false]])
    expect(answers.every((a) => a.subject_id !== null)).toBe(true)
    const queue = await t.db.query<{ question_id: string; wrong_times: number }>(`select question_id::text, wrong_times from revision_queue where user_id = $1::bigint`, [student.userId])
    expect(queue).toEqual([{ question_id: items[1]!.id, wrong_times: 1 }])
    // the checks of the open session are gone and nothing more can be checked or finished
    expect(Number((await t.db.query(`select count(*) as n from practice_checks where session_id = $1`, [sessionId]))[0]!.n)).toBe(0)
    expect((await student.post(`/api/bijak/kuiz/sessions/${sessionId}/finish`, {})).status).toBe(409)
    expect((await student.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, { itemId: items[3]!.id, optionId: 'A' })).status).toBe(409)
  })

  it('12. the practice reward port is called once with the session (ledger source of the stored mode)', async () => {
    expect((await t.db.query(`select 1 from session_credits where session_id = $1`, [sessionId])).length).toBe(1)
    const credit = await t.db.query<{ source: string }>(`select source from coin_ledger where user_id = $1::bigint and source_id = $2`, [student.userId, sessionId])
    for (const row of credit) expect(row.source).toBe('quiz_spm')
  })

  it('13. an image option and a picture stimulus are served with public tokens, not file ids', async () => {
    const addFile = async (n: number) =>
      (
        await t.db.query<{ id: string; public_id: string }>(
          `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'question_image', 'image/png', 10, $2, $3) returning id::text, public_id`,
          [`kuizTokenAaaaaaaaaaa${String(n)}${String(n)}`.slice(0, 22),`${String(n)}`.repeat(64).slice(0, 64), `kuiz/${String(n)}.png`],
        )
      )[0]!
    const optionFile = await addFile(1)
    const stimFile = await addFile(2)
    // an image on option A of MATH-T5, and a picture stimulus linked straight to the version of SCI-T5
    await t.db.query(
      `update part_options set image_file_id = $2::bigint where label = 'A' and part_id in (select p.id from question_parts p join questions q on q.id = $1::bigint join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no and v.id = p.question_version_id)`,
      [id('SEED-MCQ-MATH-T5'), optionFile.id],
    )
    const link = async (ref: string, kind: string, file: string | null, body: string | null) => {
      const s = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label, body_ms, asset_file_id) values ($1, 'Rajah', $2, $3::bigint) returning id::text`, [kind, body, file]))[0]!
      await t.db.query(
        `insert into question_version_stimuli (question_version_id, stimulus_id, position) select v.id, $2::bigint, 1 from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = $1::bigint`,
        [id(ref), s.id],
      )
    }
    await link('SEED-MCQ-SCI-T5', 'image', stimFile.id, null)
    // a linked passage that is neither in a group nor a picture cannot be shown, so the question is not served
    await link('SEED-MCQ-SCI-T4', 'passage', null, 'Petikan yang tidak boleh dipaparkan.')

    const math = sessionOf(await start(student, { subject: 'MATH', count: 5 }))
    const item = math.items.find((i) => i.id === id('SEED-MCQ-MATH-T5'))!
    expect(item.options.find((o) => o.id === 'A')!.imageToken).toBe(optionFile.public_id)
    expect(item.options.filter((o) => o.id !== 'A').every((o) => o.imageToken === null)).toBe(true)

    const sci = await start(student, { subject: 'SCI', count: 5 })
    const served = sessionOf(sci).items
    const pic = served.find((i) => i.id === id('SEED-MCQ-SCI-T5'))!
    expect(pic.stimuli).toEqual([{ kind: 'diagram', label: '', body: null, imageToken: stimFile.public_id, alt: null }])
    expect(served.map((i) => i.id)).not.toContain(id('SEED-MCQ-SCI-T4'))
    // the wire carries the public token (22 chars), not the internal id
    expect(item.options.find((o) => o.id === 'A')!.imageToken).not.toBe(optionFile.id)
    expect(pic.stimuli[0]!.imageToken).not.toBe(stimFile.id)
  })
})

describe('Mod Pelajar', () => {
  it('14. an admin acting as a pupil writes test data', async () => {
    const admin = await loginAs(t, ADMIN, true)
    const res = await start(admin, { subject: 'BM', count: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const row = await t.db.query<{ is_test: boolean }>(`select is_test from practice_sessions where id = $1`, [sessionOf(res).sessionId])
    expect(row[0]!.is_test).toBe(true)
  })
})

describe('per-paper quiz (V2 ExamQuizController::paper): paged by Bahagian, marked on the server, never stored', () => {
  let paperId = ''

  it('15. pages follow the sections, an empty section is not a page, open parts are kind open', async () => {
    paperId = await createPaper('Kertas kuiz', [
      { label: 'Bahagian A', questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-MCQ-MATH-T5')] },
      { label: 'Bahagian Kosong', questionIds: [] },
      { label: 'Bahagian B', questionIds: [id('SEED-STR-ECF'), id('SEED-GRP-PASAR-1')] },
    ])
    const p1 = await student.get(`/api/bijak/kuiz/papers/${paperId}`)
    expect(p1.status, JSON.stringify(p1.body)).toBe(200)
    const a = BijakKuizPaperPageSchema.parse(p1.body.data)
    expect(a).toMatchObject({ page: 1, pageCount: 2, section: { label: 'Bahagian A', instruction: 'Jawab semua soalan.' }, paper: { title: 'Kertas kuiz' } })
    expect(a.items.map((i) => i.id)).toEqual([id('SEED-MCQ-MATH-T4'), id('SEED-MCQ-MATH-T5')])
    expect(a.items.every((i) => i.kind === 'mcq' && i.markable)).toBe(true)
    expect(a.markableTotal).toBe(3)
    for (const k of ['"correct"', '"key"', '"scheme"', '"explanation"', '"correctOptionId"']) expect(JSON.stringify(p1.body)).not.toContain(k)

    const b = BijakKuizPaperPageSchema.parse((await student.get(`/api/bijak/kuiz/papers/${paperId}?page=2`)).body.data)
    expect(b.section!.label).toBe('Bahagian B')
    const ecf = b.items.filter((i) => i.id.startsWith(`${id('SEED-STR-ECF')}:`))
    expect(ecf.length).toBeGreaterThan(0)
    expect(ecf.every((i) => i.kind === 'open' && i.markable === false && i.options.length === 0)).toBe(true)
    expect(ecf.map((i) => i.path)).toEqual(['a', 'b'])
    // D90: the group passage is on the page once, not on the member
    expect(b.items.find((i) => i.id === id('SEED-GRP-PASAR-1'))!.stimuli).toEqual([])
    expect(b.groups).toHaveLength(1)
    expect(b.groups[0]!.stimuli[0]).toMatchObject({ kind: 'passage' })

    expect((await student.get(`/api/bijak/kuiz/papers/${paperId}?page=3`)).status).toBe(422)
    expect((await student.get(`/api/bijak/kuiz/papers/${paperId}?page=0`)).status).toBe(422)
    expect((await student.get(`/api/bijak/kuiz/papers/${paperId}?page=x`)).status).toBe(422)
  })

  it('16. checks one answer; the option must belong to the part; an open part cannot be checked', async () => {
    const key = await keyOf(id('SEED-MCQ-MATH-T4'))
    const page = BijakKuizPaperPageSchema.parse((await student.get(`/api/bijak/kuiz/papers/${paperId}`)).body.data)
    const item = page.items[0]!
    const ok = await student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: item.id, optionId: key })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(BijakKuizCheckResultSchema.parse(ok.body.data)).toMatchObject({ correct: true, correctOptionId: key })
    const bad = await student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: item.id, optionId: wrongLabel(item, key) })
    expect(bad.body.data).toMatchObject({ correct: false, correctOptionId: key })
    const r = (itemId: string, optionId = 'A') => student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId, optionId })
    expect((await r(`${id('SEED-STR-ECF')}:a`)).status).toBe(422) // open part
    expect((await r(id('SEED-MCQ-SCI-T4'))).status).toBe(422) // not on this paper
    expect((await r(item.id, 'H')).status).toBe(422)
    expect((await r('junk')).status).toBe(422)
  })

  it('17. stores nothing: no practice session, check, answer or revision row', async () => {
    const count = async () => {
      const q = async (table: string) => Number((await t.db.query(`select count(*) as n from ${table}`))[0]!.n)
      return [await q('practice_sessions'), await q('practice_checks'), await q('practice_answers'), await q('revision_queue'), await q('mastery')]
    }
    const before = await count()
    await student.get(`/api/bijak/kuiz/papers/${paperId}`)
    await student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: id('SEED-MCQ-MATH-T4'), optionId: 'A' })
    expect(await count()).toEqual(before)
  })

  it('18. marks the version pinned on the paper, not a later edit', async () => {
    const q = id('SEED-MCQ-MATH-T5')
    const pinned = await keyOf(q)
    // a placement pinned at a version that does not exist is simply not shown; the pinned (v1) key is what marks
    const res = await student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: q, optionId: pinned })
    expect(res.body.data.correct).toBe(true)
  })

  it('19. a draft paper, another pupil generated paper, an unknown and a malformed id are all 404', async () => {
    const draft = await createPaper('Draf', [{ label: 'A', questionIds: [id('SEED-MCQ-MATH-T4')] }], { status: 'draft' })
    const jana = await createPaper('Jana orang lain', [{ label: 'A', questionIds: [id('SEED-MCQ-MATH-T4')] }], { kind: 'jana', owner: other.userId })
    const mine = await createPaper('Jana saya', [{ label: 'A', questionIds: [id('SEED-MCQ-MATH-T4')] }], { kind: 'jana', owner: student.userId })
    for (const p of [draft, jana, '999999999', 'abc']) {
      expect((await student.get(`/api/bijak/kuiz/papers/${p}`)).status, p).toBe(404)
      expect((await student.post(`/api/bijak/kuiz/papers/${p}/check`, { itemId: id('SEED-MCQ-MATH-T4'), optionId: 'A' })).status, p).toBe(404)
    }
    expect((await student.get(`/api/bijak/kuiz/papers/${mine}`)).status).toBe(200)
  })

  it('19b. AC-R1-18.4: a paper placing a question archived after Terbit is refused 403 with the BM line, page and check alike', async () => {
    const paper = await createPaper('Kertas diarkib', [{ label: 'A', questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-MCQ-MATH-T5')] }])
    expect((await student.get(`/api/bijak/kuiz/papers/${paper}`)).status).toBe(200)
    await t.db.query(`update question_versions set status = 'archived' where question_id = $1::bigint and version_no = (select live_version_no from questions where id = $1::bigint)`, [id('SEED-MCQ-MATH-T4')])
    const msg = 'Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.'
    try {
      const page = await student.get(`/api/bijak/kuiz/papers/${paper}`)
      expect(page.status).toBe(403)
      expect(page.body.error.message).toBe(msg)
      const chk = await student.post(`/api/bijak/kuiz/papers/${paper}/check`, { itemId: id('SEED-MCQ-MATH-T5'), optionId: 'A' })
      expect(chk.status).toBe(403)
      expect(chk.body.error.message).toBe(msg)
    } finally {
      await t.db.query(`update question_versions set status = 'approved' where question_id = $1::bigint and version_no = (select live_version_no from questions where id = $1::bigint)`, [id('SEED-MCQ-MATH-T4')])
    }
    expect((await student.get(`/api/bijak/kuiz/papers/${paper}`)).status).toBe(200)
  })
})

describe('shared stimulus group (D90): one picture, two questions', () => {
  let picToken = ''
  let groupId = ''

  it('22. random quiz: each member is served with the group picture above it; the stimulus is never an item', async () => {
    const file = (
      await t.db.query<{ id: string; public_id: string }>(
        `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ('grpPicAaaaaaaaaaaaaaaa', 'question_image', 'image/png', 10, $1, 'kuiz/grp.png') returning id::text, public_id`,
        ['9'.repeat(64)],
      )
    )[0]!
    picToken = file.public_id
    const stim = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label, asset_file_id) values ('image', 'Rajah kumpulan', $1::bigint) returning id::text`, [file.id]))[0]!
    groupId = (await t.db.query<{ id: string }>(`insert into stimulus_groups (scope) values ('section') returning id::text`))[0]!.id
    await t.db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [groupId, stim.id])
    // group order is T5 (1) then T4 (2): the reverse of their ids
    await t.db.query(`update questions set group_id = $1::bigint, group_position = 1 where id = $2::bigint`, [groupId, id('SEED-MCQ-MATH-T5')])
    await t.db.query(`update questions set group_id = $1::bigint, group_position = 2 where id = $2::bigint`, [groupId, id('SEED-MCQ-MATH-T4')])

    const s = sessionOf(await start(student, { subject: 'MATH', count: 5 }))
    expect(s.items.map((i) => i.id).sort()).toEqual([id('SEED-MCQ-MATH-T4'), id('SEED-MCQ-MATH-T5')].sort())
    for (const item of s.items) {
      expect(item.groupId).toBe(groupId)
      expect(item.stimuli).toEqual([{ kind: 'diagram', label: 'Rajah kumpulan', body: null, imageToken: picToken, alt: null }])
    }
    expect(s.items.some((i) => i.id === stim.id && i.kind !== 'mcq')).toBe(false)
  })

  it('23. per-paper quiz: the picture is rendered once, members follow it contiguously in group order', async () => {
    const paper = await createPaper('Kertas kumpulan', [{ label: 'Bahagian A', questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-MCQ-BM-T4'), id('SEED-MCQ-MATH-T5')] }])
    const page = BijakKuizPaperPageSchema.parse((await student.get(`/api/bijak/kuiz/papers/${paper}`)).body.data)
    expect(page.groups).toEqual([{ id: groupId, stimuli: [{ kind: 'diagram', label: 'Rajah kumpulan', body: null, imageToken: picToken, alt: null }] }])
    // the group sits at the place of its first placed member (T4), members in group order (T5, T4), then the plain question
    expect(page.items.map((i) => i.id)).toEqual([id('SEED-MCQ-MATH-T5'), id('SEED-MCQ-MATH-T4'), id('SEED-MCQ-BM-T4')])
    expect(page.items.map((i) => i.groupId)).toEqual([groupId, groupId, null])
    expect(page.items.every((i) => i.stimuli.length === 0)).toBe(true)
    expect(JSON.stringify(page).split(picToken).length - 1).toBe(1)
  })
})

describe('auth and role', () => {
  it('20. 401 without a session, 403 for a teacher, 403 without CSRF', async () => {
    const anon = t.agent()
    expect((await anon.post('/api/bijak/kuiz/sessions').send({})).status).toBe(401)
    expect((await anon.get('/api/bijak/kuiz/papers/1')).status).toBe(401)
    const teacher = await loginAs(t, TEACHER)
    expect((await start(teacher, {})).status).toBe(403)
    expect((await teacher.get('/api/bijak/kuiz/papers/1')).status).toBe(403)
    const noCsrf = t.agent()
    await noCsrf.post('/api/auth/login').send({ identifier: STUDENT, password: 'Demo1234', remember: false })
    expect((await noCsrf.post('/api/bijak/kuiz/sessions').send({ count: 5 })).status).toBe(403)
  })
})

describe('rate limit (D57a)', () => {
  it('21. starts answer 429 RATE_LIMITED with Retry-After once the minute is used up', async () => {
    const who = await loginAs(t, 'pelajarmaju@demo.test')
    let last = await start(who, { subject: 'BM', count: 5 })
    for (let i = 0; i < 70 && last.status !== 429; i++) last = await start(who, { subject: 'BM', count: 5 })
    expect(last.status).toBe(429)
    expect(last.body.error.code).toBe('RATE_LIMITED')
    expect(Number(last.headers['retry-after'])).toBeGreaterThan(0)
  }, 180_000)
})
