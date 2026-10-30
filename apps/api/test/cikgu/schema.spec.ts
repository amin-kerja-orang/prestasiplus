import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { classesSeed } from '../../prisma/seed/poc/classes'
import { cikguSeed } from '../../prisma/seed/cikgu'
import { TEACHER_A, STUDENT_1, STUDENT_2, bootCikguApp, client, idOfEmail, type CikguTestApp } from './helpers'

describe('tables, constraints and indexes (AC15)', () => {
  let t: CikguTestApp
  let userId: string
  let threadId: string

  beforeAll(async () => {
    t = await bootCikguApp()
    userId = await idOfEmail(t, TEACHER_A)
    threadId = (await t.db.query<{ id: string }>(`insert into chat_threads (user_id) values ($1) returning id::text`, [userId]))[0]?.id as string
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const rejects = async (sql: string, params: unknown[], what: string | RegExp) => {
    await expect(t.db.query(sql, params), String(what)).rejects.toThrow(what)
  }

  it('the supporting indexes exist, with the sort order and the partial predicate of the card', async () => {
    const rows = await t.db.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename in ('chat_threads', 'chat_messages', 'rph_plans', 'essay_markings', 'pbd_tags')`,
    )
    const def = (name: string) => rows.find((r) => r.indexname === name)?.indexdef ?? ''
    expect(def('ix_chat_messages_user_id_created_at')).toMatch(/\(user_id, created_at\)$/)
    expect(def('ix_chat_messages_thread_id_created_at')).toMatch(/\(thread_id, created_at\)$/)
    expect(def('ix_chat_threads_user_id_updated_at')).toMatch(/\(user_id, updated_at\)$/)
    expect(def('ix_rph_plans_user_id_lesson_date_id')).toMatch(/\(user_id, lesson_date DESC, id DESC\)$/)
    expect(def('ix_essay_markings_user_id_created_at_id')).toMatch(/\(user_id, created_at DESC, id DESC\)$/)
    expect(def('uq_pbd_tags_user_id_classroom_id_student_id_sp')).toMatch(/UNIQUE INDEX .*\(user_id, classroom_id, student_id, sp\)$/)
    expect(def('ix_pbd_tags_pending')).toMatch(/\(user_id, created_at DESC\) WHERE \(status = 'pending'::text\)$/)
    expect(def('uq_chat_threads_legacy')).toMatch(/UNIQUE INDEX .*\(legacy_source, legacy_id\)/)
    expect(def('uq_chat_messages_legacy')).toMatch(/UNIQUE INDEX .*\(legacy_source, legacy_id\)/)
    // FK columns are indexed (G-08).
    for (const name of ['ix_rph_plans_thread_id', 'ix_essay_markings_thread_id', 'ix_pbd_tags_classroom_id', 'ix_pbd_tags_student_id']) expect(def(name), name).not.toBe('')
  })

  it('only the two chat tables carry legacy columns (the other three are born in v2)', async () => {
    const cols = await t.db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name in ('chat_threads', 'chat_messages', 'rph_plans', 'essay_markings', 'pbd_tags') and column_name like 'legacy%'`,
    )
    const by = (tn: string) => cols.filter((c) => c.table_name === tn).map((c) => c.column_name).sort()
    expect(by('chat_threads')).toEqual(['legacy_id', 'legacy_source'])
    expect(by('chat_messages')).toEqual(['legacy_id', 'legacy_source'])
    expect(by('rph_plans')).toEqual([])
    expect(by('essay_markings')).toEqual([])
    expect(by('pbd_tags')).toEqual([])
    const flag = await t.db.query<{ table_name: string }>(
      `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'is_test' and table_name in ('chat_threads', 'chat_messages', 'rph_plans', 'essay_markings', 'pbd_tags')`,
    )
    expect(flag).toHaveLength(5)
  })

  it('enums are text + check: bad codes are rejected by the database', async () => {
    await rejects(`insert into chat_messages (thread_id, user_id, role, text) values ($1, $2, 'robot', 'x')`, [threadId, userId], /ck_chat_messages_role/)
    await rejects(`insert into chat_messages (thread_id, user_id, role, text, tool) values ($1, $2, 'bot', 'x', 'magic')`, [threadId, userId], /ck_chat_messages_tool/)
    await rejects(`insert into chat_messages (thread_id, user_id, role, text, tool_hops) values ($1, $2, 'bot', 'x', 2)`, [threadId, userId], /ck_chat_messages_tool_hops/)
    await rejects(`insert into chat_threads (user_id, legacy_source, legacy_id) values ($1, 'other', '1')`, [userId], /ck_chat_threads_legacy_source/)
    await rejects(`insert into rph_plans (user_id, subject_name, level, tajuk, lesson_date, source, content) values ($1, 'A', 'T6', 'x', '2026-01-01', 'form', 'x')`, [userId], /ck_rph_plans_level/)
    await rejects(`insert into rph_plans (user_id, subject_name, level, tajuk, lesson_date, source, content, duration_minutes) values ($1, 'A', 'T4', 'x', '2026-01-01', 'form', 'x', 14)`, [userId], /ck_rph_plans_duration_minutes/)
    await rejects(`insert into rph_plans (user_id, subject_name, level, tajuk, lesson_date, source, content) values ($1, 'A', 'T4', 'x', '2026-01-01', 'web', 'x')`, [userId], /ck_rph_plans_source/)
    await rejects(`insert into rph_plans (user_id, subject_name, level, tajuk, lesson_date, source, content, status) values ($1, 'A', 'T4', 'x', '2026-01-01', 'form', 'x', 'draft')`, [userId], /ck_rph_plans_status/)
    await rejects(`insert into essay_markings (user_id, rubric_key, essay_text, marks, max_marks, comment, thread_id) values ($1, 'nope', 'x', 1, 2, 'x', $2)`, [userId, threadId], /ck_essay_markings_rubric_key/)
    await rejects(`insert into essay_markings (user_id, rubric_key, essay_text, marks, max_marks, comment, thread_id) values ($1, 'general', 'x', 101, 100, 'x', $2)`, [userId, threadId], /ck_essay_markings_marks/)
  })

  it('PBD tags: status, tp and skor checks, and one tag per (teacher, class, student, sp)', async () => {
    const level = (await t.db.query<{ id: string }>(`select id::text from education_levels where stage <> 'primary' order by id limit 1`))[0]?.id as string
    const cls = (await t.db.query<{ id: string }>(`insert into classrooms (name, teacher_id, education_level_id, academic_year) values ('K', $1, $2, 2026) returning id::text`, [userId, level]))[0]?.id as string
    const stu = await idOfEmail(t, STUDENT_1)
    const ins = `insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, status) values ($1, $2, $3, '1.1.1', $4, $5, $6)`
    await rejects(ins, [userId, cls, stu, 50, 3, 'done'], /ck_pbd_tags_status/)
    await rejects(ins, [userId, cls, stu, 50, 7, 'pending'], /ck_pbd_tags_tp/)
    await rejects(ins, [userId, cls, stu, 100.5, 6, 'pending'], /ck_pbd_tags_skor|numeric field overflow/)
    await t.db.query(ins, [userId, cls, stu, 50, 3, 'pending'])
    await rejects(ins, [userId, cls, stu, 60, 4, 'pending'], /uq_pbd_tags_user_id_classroom_id_student_id_sp/)
    // A deleted class takes its tags with it, a deleted pupil too.
    await t.db.query(`delete from classrooms where id = $1`, [cls])
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from pbd_tags`))[0]?.n).toBe(0)
  })

  it('deleting a thread removes its messages and markings; an RPH made in the chat keeps the plan and loses the link', async () => {
    const th = (await t.db.query<{ id: string }>(`insert into chat_threads (user_id) values ($1) returning id::text`, [userId]))[0]?.id as string
    await t.db.query(`insert into chat_messages (thread_id, user_id, role, text) values ($1, $2, 'user', 'x')`, [th, userId])
    await t.db.query(`insert into essay_markings (user_id, rubric_key, essay_text, marks, max_marks, comment, thread_id) values ($1, 'general', 'x', 1, 100, 'x', $2)`, [userId, th])
    await t.db.query(`insert into rph_plans (user_id, subject_name, level, tajuk, lesson_date, source, content, thread_id) values ($1, 'A', 'T4', 'x', '2026-01-01', 'chat', 'x', $2)`, [userId, th])
    await t.db.query(`delete from chat_threads where id = $1`, [th])
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from chat_messages where thread_id = $1`, [th]))[0]?.n).toBe(0)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from essay_markings where thread_id = $1`, [th]))[0]?.n).toBe(0)
    const rph = await t.db.query<{ thread_id: string | null }>(`select thread_id::text from rph_plans where tajuk = 'x' and source = 'chat'`)
    expect(rph).toEqual([{ thread_id: null }])
  })

  it('AC15: the daily-count query for a user with 10,000 messages is served by the (user_id, created_at) index', async () => {
    const big = await idOfEmail(t, STUDENT_2)
    const th = (await t.db.query<{ id: string }>(`insert into chat_threads (user_id) values ($1) returning id::text`, [big]))[0]?.id as string
    // 10,000 messages of the user over 100 days, 100 a day; plus another user's 10,000 so the table is not one user's.
    await t.db.query(
      `insert into chat_messages (thread_id, user_id, role, text, created_at)
       select $1, $2, case when g % 2 = 0 then 'user' else 'bot' end, 'x', timestamptz '2026-07-01 00:00:00+08' + (g / 100) * interval '1 day' + (g % 100) * interval '1 minute'
         from generate_series(1, 10000) g`,
      [th, big],
    )
    await t.db.query(
      `insert into chat_messages (thread_id, user_id, role, text, created_at)
       select $1, $2, 'user', 'x', timestamptz '2026-07-01 00:00:00+08' + (g / 100) * interval '1 day' + (g % 100) * interval '1 minute'
         from generate_series(1, 10000) g`,
      [threadId, userId],
    )
    await t.db.query(`analyze chat_messages`)
    const day = '2026-08-15 00:00:00+08'
    const plan = (
      await t.db.query<{ 'QUERY PLAN': string }>(
        `explain (analyze, buffers, costs on) select count(*) from chat_messages where user_id = $1 and role = 'user' and created_at >= $2::timestamptz and created_at < $2::timestamptz + interval '1 day'`,
        [big, day],
      )
    ).map((r) => r['QUERY PLAN'])
    const text = plan.join('\n')
    expect(text).toMatch(/Index (Only )?Scan using ix_chat_messages_user_id_created_at|Bitmap Index Scan on ix_chat_messages_user_id_created_at/)
    expect(text).not.toMatch(/Seq Scan on chat_messages/)
    const out = process.env.CIKGU_EXPLAIN_FILE
    if (out) {
      mkdirSync(join(out, '..'), { recursive: true })
      writeFileSync(
        out,
        `EXPLAIN (ANALYZE, BUFFERS) of the BR-M13-06 daily-count query\n` +
          `table chat_messages: 20,000 rows, 10,000 of them for the user (100 days x 100 messages)\n` +
          `index: ix_chat_messages_user_id_created_at on (user_id, created_at)\n\n` +
          `select count(*) from chat_messages where user_id = $1 and role = 'user' and created_at >= $2 and created_at < $2 + interval '1 day'\n\n` +
          `${text}\n`,
      )
    }
  })
})

describe('the demo seed', () => {
  let t: CikguTestApp

  beforeAll(async () => {
    t = await bootCikguApp({ seeds: [classesSeed, cikguSeed] })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const counts = async () =>
    (
      await t.db.query<Record<string, number>>(
        `select (select count(*)::int from rph_plans) rphs, (select count(*)::int from essay_markings) essays, (select count(*)::int from pbd_tags) tags,
                (select count(*)::int from chat_threads) threads, (select count(*)::int from chat_messages) messages`,
      )
    )[0]

  it('gives the demo teacher 2 plans, 1 marking and 2 pending tags, uses no quota and sets no legacy value; a second run changes nothing', async () => {
    const first = await counts()
    expect(first).toEqual({ rphs: 2, essays: 1, tags: 2, threads: 1, messages: 0 })
    await runSeeds([cikguSeed], { prisma: t.db.prisma })
    await runSeeds([cikguSeed], { prisma: t.db.prisma })
    expect(await counts()).toEqual(first)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from chat_threads where legacy_source is not null or legacy_id is not null`))[0]?.n).toBe(0)
  })

  it('the seeded rows are served by the API to the teacher and to nobody else', async () => {
    const teacher = await client(t, TEACHER_A)
    const rph = await teacher.get('/cikgu/rph')
    expect(rph.body.meta.totalItems).toBe(2)
    expect((await teacher.get('/cikgu/essays')).body.meta.totalItems).toBe(1)
    const queue = await teacher.get('/cikgu/pbd')
    expect(queue.body.data.map((x: { skor: number; tp: number }) => [x.skor, x.tp])).toEqual(expect.arrayContaining([[72.5, 4], [45, 3]]))
    expect(queue.body.meta.totalItems).toBe(2)
    const student = await client(t, STUDENT_1)
    expect((await student.get('/cikgu/rph')).status).toBe(403)
    // The first chat turn of the teacher is still 29 left: the seed stored no messages.
    expect((await teacher.post('/cikgu/send', { message: 'hai' })).body.turns_remaining).toBe(29)
  })
})
