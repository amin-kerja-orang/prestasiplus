import {
  CIKGU_GENERAL_REPLY,
  CIKGU_PRACTICE_REPLY,
  CIKGU_RPH_FOLLOW_UP,
  CikguSendResponseSchema,
  cikguMarkingReply,
  cikguTokensIn,
  cikguTokensOut,
  CIKGU_RUBRICS,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { rphContent } from '../../src/modules/cikgu/rules'
import { ADMIN, STUDENT_1, TEACHER_A, STUDENT_2, STUDENT_3, TEACHER_B, bootCikguApp, client, handoff, idOfEmail, type CikguTestApp, type Client, type Sent } from './helpers'

describe('POST /api/cikgu/send: the chat turn', () => {
  let t: CikguTestApp
  let teacher: Client
  let student: Client
  let student2: Client
  let student3: Client
  let admin: Client
  let teacherId: string

  beforeAll(async () => {
    t = await bootCikguApp()
    teacher = await client(t, TEACHER_A)
    student = await client(t, STUDENT_1)
    student2 = await client(t, STUDENT_2)
    student3 = await client(t, STUDENT_3)
    admin = await client(t, ADMIN)
    teacherId = await idOfEmail(t, TEACHER_A)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const send = (who: Client, message: unknown, thread_id: unknown = null) => who.post('/cikgu/send', { message, thread_id })
  const count = async (sql: string, params: unknown[] = []): Promise<number> => (await t.db.query<{ n: number }>(sql, params))[0]?.n as number

  it('AC2/3: a guest gets exactly 401 with the body {}', async () => {
    const res = await t.http().post('/api/cikgu/send').send({ message: 'hai' })
    expect(res.status).toBe(401)
    expect(res.text).toBe('{}')
  })

  it('AC2: a missing CSRF header is 403 CSRF_INVALID in the standard envelope', async () => {
    const res = await student.postNoCsrf('/cikgu/send', { message: 'hai' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('CSRF_INVALID')
  })

  it('AC3: a blank, missing or non-string message is 422 {} and nothing is stored', async () => {
    const before = await count(`select count(*)::int n from chat_messages`)
    for (const message of ['', '   \n', undefined, 42, null, ['a'], { a: 1 }]) {
      const res = await send(student, message)
      expect(res.status).toBe(422)
      expect(res.text).toBe('{}')
    }
    const noBody = await student.post('/cikgu/send', {})
    expect(noBody.status).toBe(422)
    expect(noBody.text).toBe('{}')
    expect(await count(`select count(*)::int n from chat_messages`)).toBe(before)
    expect(await count(`select count(*)::int n from chat_threads`)).toBe(0)
  })

  it('a malformed JSON body is rejected by the body parser before the route: standard 422 VALIDATION_ERROR envelope, nothing stored', async () => {
    const res = await student.who.agent.post('/api/cikgu/send').set('X-CSRF-Token', student.who.csrf).set('Content-Type', 'application/json').send('{"message":')
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(await count(`select count(*)::int n from chat_messages`)).toBe(0)
  })

  it('AC3/6/7: the success body is raw JSON in the contract key order, with the canned general reply and the token formula', async () => {
    const message = 'Terangkan konsep mol'
    const res = await send(teacher, message)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const body = JSON.parse(res.text) as Sent
    expect(res.text).toBe(
      JSON.stringify({
        thread_id: body.thread_id,
        reply: CIKGU_GENERAL_REPLY,
        tier: 'guru',
        turns_remaining: 29,
        tool_hops: 0,
        tokens: { in: 120 + Math.ceil(message.length / 4), out: Math.ceil([...CIKGU_GENERAL_REPLY].length / 4) },
      }),
    )
    expect(Object.keys(body)).not.toContain('data')
    expect(CikguSendResponseSchema.safeParse(body).success).toBe(true)
    expect(body.thread_id).toMatch(/^[1-9]\d*$/)
  })

  it('AC7: tokens count Unicode code points (an emoji is one)', async () => {
    const message = '🎤🎤🎤🎤🎤🎤 hai'
    expect([...message].length).toBe(10)
    const res = await send(teacher, message)
    expect(res.body.tokens).toEqual({ in: 120 + 3, out: cikguTokensOut(CIKGU_GENERAL_REPLY) })
    expect(res.body.tokens.in).toBe(cikguTokensIn(message))
    // The trimmed message is counted.
    const padded = await send(teacher, '   abcd   ')
    expect(padded.body.tokens.in).toBe(121)
  })

  it('AC5: the same thread id continues the thread, both messages are stored with the same time', async () => {
    const first = await send(student2, 'Terangkan fotosintesis')
    const id = first.body.thread_id as string
    const second = await send(student2, 'Minta latihan soalan fotosintesis', id)
    expect(second.body.thread_id).toBe(id)
    expect(second.body.reply).toBe(CIKGU_PRACTICE_REPLY)
    expect(second.body.tool_hops).toBe(1)
    const rows = await t.db.query<{ role: string; tool: string | null; tool_hops: number; tokens_in: number; created_at: string }>(
      `select role, tool, tool_hops, tokens_in, created_at::text from chat_messages where thread_id = $1 order by id`,
      [id],
    )
    expect(rows.map((r) => [r.role, r.tool, r.tool_hops])).toEqual([
      ['user', null, 0],
      ['bot', null, 0],
      ['user', null, 0],
      ['bot', 'practice', 1],
    ])
    expect(rows[0]?.tokens_in).toBe(0)
    expect(rows[1]?.created_at).toBe(rows[0]?.created_at)
    expect(await count(`select count(*)::int n from chat_threads where id = $1`, [id])).toBe(1)
  })

  it('AC5: a null, unknown, non-numeric, non-string or another user\'s thread id starts a new thread and reveals nothing', async () => {
    const own = (await send(student3, 'hai')).body.thread_id as string
    for (const thread_id of ['999999999', 'thr-9000001', 'abc', '', 12, {}, ['x'], true]) {
      const res = await send(student3, 'hai', thread_id)
      expect(res.status, JSON.stringify(thread_id)).toBe(200)
      expect(res.body.thread_id).not.toBe(own)
    }
    const foreign = await send(teacher, 'hai', own)
    expect(foreign.status).toBe(200)
    expect(foreign.body.thread_id).not.toBe(own)
    // The student's thread was not touched by the teacher: still only the student's two messages.
    expect(await count(`select count(*)::int n from chat_messages where thread_id = $1`, [own])).toBe(2)
    expect(await count(`select count(*)::int n from chat_messages where thread_id = $1 and user_id = $2`, [foreign.body.thread_id, teacherId])).toBe(2)
  })

  it('AC6: routing, first match, case-insensitive: general, practice, rph', async () => {
    expect((await send(teacher, 'Minta Latihan topik ini')).body).toMatchObject({ reply: CIKGU_PRACTICE_REPLY, tool_hops: 1 })
    expect((await send(teacher, 'ada soalan?')).body).toMatchObject({ reply: CIKGU_PRACTICE_REPLY, tool_hops: 1 })
    expect((await send(teacher, 'Jana rph untuk saya, minta latihan')).body.reply).toBe(CIKGU_RPH_FOLLOW_UP)
    expect((await send(teacher, 'Terangkan konsep mol')).body).toMatchObject({ reply: CIKGU_GENERAL_REPLY, tool_hops: 0 })
  })

  it('AC6: an RPH request without subject or level asks a follow-up, hops 0, stores no plan', async () => {
    const before = await count(`select count(*)::int n from rph_plans`)
    const res = await send(teacher, 'Tolong jana RPH untuk esok')
    expect(res.body).toMatchObject({ reply: CIKGU_RPH_FOLLOW_UP, tool_hops: 0 })
    const res2 = await send(teacher, 'Tolong jana RPH Matematik')
    expect(res2.body).toMatchObject({ reply: CIKGU_RPH_FOLLOW_UP, tool_hops: 0 })
    expect(await count(`select count(*)::int n from rph_plans`)).toBe(before)
    const bot = await t.db.query<{ tool: string | null; tool_hops: number }>(
      `select tool, tool_hops from chat_messages where thread_id = $1 and role = 'bot'`,
      [res.body.thread_id],
    )
    expect(bot).toEqual([{ tool: null, tool_hops: 0 }])
  })

  it('AC6: "Tolong jana RPH untuk Matematik T4 Bab 3 esok" stores an RPH for tomorrow (Malaysia date)', async () => {
    const res = await send(teacher, 'Tolong jana RPH untuk Matematik T4 Bab 3 esok')
    expect(res.status).toBe(200)
    expect(res.body.tool_hops).toBe(1)
    expect(res.body.reply).toBe('Siap! RPH "Bab 3" (Matematik, Tingkatan 4) untuk 20/10/2026 telah dijana dan disimpan dalam senarai RPH.')
    const rows = await t.db.query<Record<string, unknown>>(
      `select subject_name, level, tajuk, lesson_date::text, duration_minutes, source, status, thread_id::text, content, class_name
         from rph_plans where thread_id = $1`,
      [res.body.thread_id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ subject_name: 'Matematik', level: 'T4', tajuk: 'Bab 3', lesson_date: '2026-10-20', duration_minutes: 60, source: 'chat', status: 'generated', class_name: null })
    expect(rows[0]?.content).toBe(rphContent({ subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3', className: null, dateLabel: '20/10/2026', durationMinutes: 60, timeSlot: null, tema: null, pengajaranKeperluan: null }))
    // Today and the longest subject name.
    const today = await send(teacher, 'jana rph Matematik Tambahan Tingkatan 5 Fungsi hari ini')
    expect(today.body.reply).toContain('"Fungsi" (Matematik Tambahan, Tingkatan 5) untuk 19/10/2026')
    const row = await t.db.query<{ lesson_date: string }>(`select lesson_date::text from rph_plans where thread_id = $1`, [today.body.thread_id])
    expect(row[0]?.lesson_date).toBe('2026-10-19')
  })

  it('AC6: the Malaysia date, not the UTC date, decides "today" and "tomorrow" (00:30 +08:00 is still yesterday in UTC)', async () => {
    t.clock.set('2026-10-19T00:30:00+08:00')
    try {
      const res = await send(teacher, 'Tolong jana RPH untuk Sains T2 Sel hari ini')
      expect(res.body.reply).toContain('untuk 19/10/2026')
    } finally {
      t.clock.set('2026-10-19T09:00:00+08:00')
    }
  })

  it('AC6: the hand-off message stores one marking with marks = round(0.7 x max) for all six rubrics', async () => {
    const expected: [string, number, number][] = [
      ['spm_bm_karangan', 35, 50],
      ['spm_bi_continuous_writing', 35, 50],
      ['pt3_bm_karangan', 21, 30],
      ['pt3_bi_essay', 21, 30],
      ['sejarah_essay', 14, 20],
      ['general', 70, 100],
    ]
    for (const [key, marks, max] of expected) {
      const essay = `Membaca membuka minda dan menambah ilmu. Ia juga menghiburkan (${key}).`
      const message = handoff({ rubric: key, subject: 'Bahasa Melayu', level: 'T3', student: 'Murid Contoh Satu', title: `Tajuk ${key}`, essay })
      const res = await send(teacher, message)
      expect(res.status).toBe(200)
      const rubric = CIKGU_RUBRICS.find((r) => r.key === key)!
      expect(res.body.reply).toBe(cikguMarkingReply(rubric, marks))
      expect(res.body.reply.startsWith(`Markah: ${String(marks)}/${String(max)}\nRubric: ${rubric.label}\nKomen membina:\n`)).toBe(true)
      expect(res.body.tool_hops).toBe(1)
      const rows = await t.db.query<Record<string, unknown>>(`select * from essay_markings where thread_id = $1`, [res.body.thread_id])
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        user_id: teacherId,
        rubric_key: key,
        subject_name: 'Bahasa Melayu',
        level: 'T3',
        student_name: 'Murid Contoh Satu',
        essay_title: `Tajuk ${key}`,
        essay_text: essay,
        marks,
        max_marks: max,
        comment: res.body.reply,
      })
    }
  })

  it('AC6: an unknown rubric label falls back to the first rubric; absent parts are null', async () => {
    const res = await send(teacher, 'Tolong mark karangan ini menggunakan rubric Tidak Wujud. Karangan: satu dua tiga')
    expect(res.body.reply).toContain('Markah: 35/50\nRubric: SPM Bahasa Melayu')
    const rows = await t.db.query<Record<string, unknown>>(`select rubric_key, subject_name, level, student_name, essay_title, essay_text from essay_markings where thread_id = $1`, [res.body.thread_id])
    expect(rows[0]).toEqual({ rubric_key: 'spm_bm_karangan', subject_name: null, level: null, student_name: null, essay_title: null, essay_text: 'satu dua tiga' })
  })

  it('a message over 2000 code points is 422 with the raw VALIDATION_ERROR body and stores nothing; exactly 2000 passes', async () => {
    const before = await count(`select count(*)::int n from chat_messages`)
    const tooLong = await send(student, '🎤'.repeat(2001))
    expect(tooLong.status).toBe(422)
    expect(tooLong.text).toBe(JSON.stringify({ error: 'Mesej terlalu panjang (maksimum 2000 aksara).', code: 'VALIDATION_ERROR' }))
    expect(await count(`select count(*)::int n from chat_messages`)).toBe(before)
    const exact = await send(student, '🎤'.repeat(2000))
    expect(exact.status).toBe(200)
  })

  it('AC2: a role other than teacher can chat (student, admin), each with its tier', async () => {
    expect((await send(student, 'hai')).body).toMatchObject({ tier: 'pelajar' })
    expect((await send(admin, 'hai')).body).toMatchObject({ tier: 'admin', turns_remaining: 99 })
  })
})

describe('POST /api/cikgu/send: the daily quota (BR-M13-06)', () => {
  let t: CikguTestApp

  beforeAll(async () => {
    t = await bootCikguApp()
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const messages = async (): Promise<number> => (await t.db.query<{ n: number }>(`select count(*)::int n from chat_messages`))[0]?.n as number

  it('AC4: a teacher has 30 turns a day (guru, 29 left on the first); the 31st is 429 {"quota_exhausted":true} and stores nothing', async () => {
    const teacher = await client(t, TEACHER_B)
    let last: Sent | undefined
    for (let i = 0; i < 30; i++) {
      const res = await teacher.post('/cikgu/send', { message: `Terangkan topik ${String(i)}` })
      expect(res.status, `turn ${String(i + 1)}`).toBe(200)
      expect(res.body.tier).toBe('guru')
      expect(res.body.turns_remaining).toBe(29 - i)
      last = res.body as Sent
    }
    expect(last?.turns_remaining).toBe(0)
    const before = await messages()
    const res = await teacher.post('/cikgu/send', { message: 'satu lagi' })
    expect(res.status).toBe(429)
    expect(res.text).toBe('{"quota_exhausted":true}')
    expect(res.body.error).toBeUndefined()
    expect(await messages()).toBe(before)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from chat_threads`))[0]?.n).toBe(30)
  })

  it('AC4: the count resets after 00:00 Asia/Kuala_Lumpur and not before', async () => {
    // 23:59 the same Malaysia day: still exhausted.
    t.clock.set('2026-10-19T23:59:30+08:00')
    const late = await client(t, TEACHER_B)
    expect((await late.post('/cikgu/send', { message: 'hai' })).status).toBe(429)
    // 00:00:01 the next Malaysia day (still 16:00 UTC of the day before): a fresh count.
    t.clock.set('2026-10-20T00:00:01+08:00')
    const teacher = await client(t, TEACHER_B)
    const res = await teacher.post('/cikgu/send', { message: 'hai' })
    expect(res.status).toBe(200)
    expect(res.body.turns_remaining).toBe(29)
  })

  it('AC4: a student has 10 turns (pelajar) and an admin 100 (admin)', async () => {
    const student = await client(t, STUDENT_1)
    for (let i = 0; i < 10; i++) {
      const res = await student.post('/cikgu/send', { message: 'hai' })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ tier: 'pelajar', turns_remaining: 9 - i })
    }
    expect((await student.post('/cikgu/send', { message: 'hai' })).status).toBe(429)

    const admin = await client(t, ADMIN)
    await t.db.query(
      `insert into chat_threads (user_id, created_at, updated_at) values ($1, '2026-10-20T10:00:00+08:00', '2026-10-20T10:00:00+08:00')`,
      [await idOfEmail(t, ADMIN)],
    )
    const threadId = (await t.db.query<{ id: string }>(`select id::text from chat_threads where user_id = $1`, [await idOfEmail(t, ADMIN)]))[0]?.id as string
    // 99 turns already used today (inserted directly), so exactly one is left.
    await t.db.query(
      `insert into chat_messages (thread_id, user_id, role, text, created_at) select $1, $2, 'user', 'x', '2026-10-20T10:00:00+08:00' from generate_series(1, 99)`,
      [threadId, await idOfEmail(t, ADMIN)],
    )
    const last = await admin.post('/cikgu/send', { message: 'hai', thread_id: threadId })
    expect(last.status).toBe(200)
    expect(last.body).toMatchObject({ tier: 'admin', turns_remaining: 0 })
    expect((await admin.post('/cikgu/send', { message: 'hai' })).status).toBe(429)
  })

  it('bot messages are not turns: only role user messages are counted', async () => {
    const teacher = await client(t, TEACHER_A)
    const res = await teacher.post('/cikgu/send', { message: 'hai' })
    expect(res.body.turns_remaining).toBe(29)
    const res2 = await teacher.post('/cikgu/send', { message: 'hai' })
    expect(res2.body.turns_remaining).toBe(28)
  })
})
