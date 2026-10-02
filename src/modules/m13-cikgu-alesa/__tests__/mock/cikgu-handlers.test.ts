/**
 * M13-T1: the Cikgu Alesa mock handlers (SRS M13 v1.1 §7 #1–#10), the designed seeds (§6.8.3) and the
 * test hooks (§6.9), over the real stores of M01–M05, M08, M10 and M13 at the project clock
 * (2026-09-25 15:40 MYT). Tests run in order and share one runtime: a write made by an earlier test
 * is accounted for in the later expectations.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'

import { VALIDATION_MSG } from '../../mock/repository/cikgu'
import { GENERAL_REPLY, PRACTICE_REPLY, RPH_FOLLOW_UP } from '../../mock/repository/canned'
import { cikgu } from '../../mock'
import { m13Hooks } from '../../mock/hooks'
import {
  SEED_ESSAYS,
  SEED_MESSAGES,
  SEED_PBD,
  SEED_RPHS,
  SEED_THREADS,
} from '../../mock/seeds/seed'
import { buildHandoffMessage } from '../../api/settings'
import { bootM13, m05 } from './helpers'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5

let runtime: MockRuntime

beforeAll(async () => {
  ;({ runtime } = await bootM13())
}, 240_000)

interface Answer<T = unknown> {
  status: number
  body: T
  res: TransportResponse
}

async function call<T = unknown>(
  method: 'GET' | 'POST',
  url: string,
  options: { as?: number | null; body?: unknown } = {},
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  const who = options.as === undefined ? GURU : options.as
  if (who !== null) headers.authorization = `Bearer ${setUser(who).token}`
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(options.body !== undefined ? { body: options.body } : {}),
  })
  return { status: res.status, body: res.body as T, res }
}

interface Data<T> {
  data: T
}
interface ListBody<T> {
  data: T[]
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number }
}
interface ErrorBody {
  error: { code: string; fields?: Record<string, string> }
}
interface Sent {
  thread_id: string
  reply: string
  tier: string
  turns_remaining: number
  tool_hops: number
  tokens: { in: number; out: number }
}

const send = (message: unknown, thread_id: string | null = null, as?: number) =>
  call<Sent>('POST', '/api/cikgu/send', {
    body: { message, thread_id },
    ...(as === undefined ? {} : { as }),
  })

// ---------------------------------------------------------------------------------------------
describe('designed seeds (SRS §6.8)', () => {
  it('holds the designed counts, owner and id ranges', () => {
    expect(SEED_RPHS.map((r) => r.id)).toEqual([13101, 13102])
    expect(SEED_ESSAYS.map((r) => r.id)).toEqual([13201, 13202])
    expect(SEED_PBD).toHaveLength(11)
    expect(SEED_PBD.filter((t) => t.status === 'pending')).toHaveLength(9)
    expect(SEED_THREADS.map((t) => t.id)).toEqual(['thr-13401', 'thr-13402'])
    expect(SEED_MESSAGES).toHaveLength(10)
    expect(SEED_MESSAGES.map((m) => m.id).sort((a, b) => a - b)).toEqual([
      13501, 13502, 13503, 13504, 13505, 13506, 13507, 13508, 13509, 13510,
    ])
    for (const row of [...SEED_RPHS, ...SEED_ESSAYS, ...SEED_PBD, ...SEED_THREADS]) {
      expect(row.userId).toBe(GURU)
    }
  })

  it('uses the designed essay lengths, marks and no real names', () => {
    expect(SEED_ESSAYS[0]?.essayText).toHaveLength(312)
    expect(SEED_ESSAYS[1]?.essayText).toHaveLength(268)
    expect(SEED_ESSAYS.map((e) => `${e.marks}/${e.maxMarks}`)).toEqual(['35/50', '14/20'])
    expect(SEED_ESSAYS.map((e) => e.studentName)).toEqual(['Murid Demo 01', 'Murid Demo 02'])
  })

  it('has the designed PBD scores', () => {
    const by = (id: number) => SEED_PBD.find((t) => t.id === id)
    expect(by(13301)).toMatchObject({ studentId: 3001, skor: 88.9, tp: 5, classroomId: 2001 })
    expect(by(13302)).toMatchObject({ skor: 50, tp: 3 })
    expect([13303, 13304, 13305, 13306].map((i) => [by(i)?.skor, by(i)?.tp])).toEqual(
      Array(4).fill([37.5, 2]),
    )
    expect(by(13307)).toMatchObject({ skor: 33.3, tp: 2 })
    expect(by(13308)).toMatchObject({ skor: 12.5, tp: 1 })
    expect(by(13309)).toMatchObject({ status: 'approved', skor: 80, tp: 5, classroomId: 2002 })
    expect(by(13310)).toMatchObject({ status: 'approved', skor: 60, tp: 4 })
    expect(by(13311)).toMatchObject({ status: 'pending', skor: 40, tp: 3, classroomId: 2002 })
  })

  it('is stored in the plugin tables', () => {
    expect(cikgu.threadsOf(GURU).map((t) => t.id)).toEqual(['thr-13401', 'thr-13402'])
    expect(cikgu.messagesOf('thr-13401')).toHaveLength(6)
    expect(cikgu.messagesOf('thr-13402')).toHaveLength(4)
    expect(cikgu.turnsUsed(GURU, Date.parse('2026-09-25T15:40:00+08:00'))).toBe(2)
    expect(cikgu.turnsUsed(ADMIN, Date.parse('2026-09-25T15:40:00+08:00'))).toBe(0)
  })
})

// ---------------------------------------------------------------------------------------------
describe('guards (BR-M13-02, SRS §7)', () => {
  it('answers 401 to a guest and 403 to a non-teacher on every T route', async () => {
    const routes: ['GET' | 'POST', string][] = [
      ['GET', '/api/cikgu/rph'],
      ['POST', '/api/cikgu/rph'],
      ['GET', '/api/cikgu/rph/13101'],
      ['GET', '/api/cikgu/essays'],
      ['GET', '/api/cikgu/essays/13201'],
      ['GET', '/api/cikgu/pbd'],
      ['POST', '/api/cikgu/pbd/rollup'],
      ['POST', '/api/cikgu/pbd/bulk-approve'],
      ['GET', '/api/cikgu/pbd/export.csv'],
    ]
    for (const [method, url] of routes) {
      const body = method === 'POST' ? { body: {} } : {}
      expect((await call(method, url, { as: null, ...body })).status, `${url} guest`).toBe(401)
      const r = await call<ErrorBody>(method, url, { as: PELAJAR, ...body })
      expect(r.status, `${url} pelajar`).toBe(403)
      expect(r.body.error.code).toBe('FORBIDDEN')
    }
  })

  it('answers the chat guest with the live-shaped 401 {}', async () => {
    const r = await call('POST', '/api/cikgu/send', {
      as: null,
      body: { message: 'hai', thread_id: null },
    })
    expect(r.status).toBe(401)
    expect(r.body).toEqual({})
  })
})

// ---------------------------------------------------------------------------------------------
describe('#1 POST /api/cikgu/send', () => {
  let firstThread = ''

  it('answers a blank or missing message with 422 {}', async () => {
    for (const message of ['', '   \n', undefined, 42]) {
      const r = await send(message)
      expect(r.status).toBe(422)
      expect(r.body).toEqual({})
    }
    expect(cikgu.turnsUsed(GURU, Date.parse('2026-09-25T15:40:00+08:00'))).toBe(2)
  })

  it('answers the live body: general reply, tier guru, 27 turns left, tokens by BR-M13-05', async () => {
    const message = 'Terangkan konsep mol'
    const r = await send(message)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({
      thread_id: 'thr-9000001',
      reply: GENERAL_REPLY,
      tier: 'guru',
      turns_remaining: 27,
      tool_hops: 0,
      tokens: {
        in: 120 + Math.ceil(message.length / 4),
        out: Math.ceil([...GENERAL_REPLY].length / 4),
      },
    })
    expect(Object.keys(r.body as object)).not.toContain('data')
    firstThread = r.body.thread_id
  })

  it('continues the thread and stores both messages', async () => {
    const r = await send('Minta latihan soalan konsep mol', firstThread)
    expect(r.body).toMatchObject({
      thread_id: firstThread,
      reply: PRACTICE_REPLY,
      turns_remaining: 26,
      tool_hops: 1,
    })
    const msgs = cikgu.messagesOf(firstThread)
    expect(msgs.map((m) => [m.role, m.tool])).toEqual([
      ['user', null],
      ['bot', null],
      ['user', null],
      ['bot', 'practice'],
    ])
  })

  it('starts a new thread for an unknown or foreign thread id (BR-M13-03, SEC-M13-08)', async () => {
    const unknown = await send('hai', 'thr-nope')
    expect(unknown.body.thread_id).toMatch(/^thr-90000\d\d$/)
    expect(unknown.body.thread_id).not.toBe(firstThread)
    const foreign = await send('hai', firstThread, ADMIN)
    expect(foreign.body.thread_id).not.toBe(firstThread)
    expect(foreign.body).toMatchObject({ tier: 'admin', turns_remaining: 99 })
    expect(cikgu.threadsOf(ADMIN)).toHaveLength(1)
  })

  it('applies the pelajar tier to a student', async () => {
    const r = await send('hai', null, PELAJAR)
    expect(r.body).toMatchObject({ tier: 'pelajar', turns_remaining: 9 })
  })

  it('asks a follow-up for an RPH request without subject or level and saves nothing', async () => {
    const before = cikgu.rphList(GURU, 1).total
    const r = await send('Tolong jana RPH untuk esok')
    expect(r.body).toMatchObject({ reply: RPH_FOLLOW_UP, tool_hops: 0 })
    expect(cikgu.rphList(GURU, 1).total).toBe(before)
  })

  it('saves an RPH for a complete request (BR-M13-10, FR-M13-28)', async () => {
    const r = await send('Tolong jana RPH untuk Kimia T5 Asid dan Bes esok')
    expect(r.body.tool_hops).toBe(1)
    expect(r.body.reply).toBe(
      'Siap! RPH "Asid dan Bes" (Kimia, Tingkatan 5) untuk 26/09/2026 telah dijana dan disimpan dalam senarai RPH.',
    )
    const rows = cikgu.rphList(GURU, 1).rows
    const saved = rows.find((x) => x.tajuk === 'Asid dan Bes')
    expect(saved).toMatchObject({
      id: 9_000_001,
      source: 'chat',
      lessonDate: '2026-09-26',
      level: 'T5',
      durationMinutes: 60,
      status: 'generated',
      threadId: r.body.thread_id,
    })
    expect(saved?.content).toContain('Set Induksi (6 minit)')
  })

  it('runs mark_essay for a hand-off message and saves the marking (FR-M13-27)', async () => {
    const essay =
      'Membaca membuka minda dan menambah ilmu pengetahuan yang berguna kepada semua murid. '.repeat(
        2,
      )
    const r = await send(
      buildHandoffMessage({
        rubric: 'pt3_bm_karangan',
        subject: 'Bahasa Melayu',
        level: 'T3',
        student: 'Murid Demo 03',
        title: 'Membaca',
        essay,
      }),
    )
    expect(r.body.tool_hops).toBe(1)
    expect(r.body.reply).toContain('Markah: 21/30')
    const list = await call<
      ListBody<{ id: number; studentName: string; marks: number; maxMarks: number }>
    >('GET', '/api/cikgu/essays')
    expect(list.body.data[0]).toMatchObject({
      id: 9_000_001,
      studentName: 'Murid Demo 03',
      marks: 21,
      maxMarks: 30,
    })
    const one = await call<
      Data<{ essayText: string; comment: string; threadId: string; rubricKey: string }>
    >('GET', '/api/cikgu/essays/9000001')
    expect(one.body.data.essayText).toBe(essay.trim())
    expect(one.body.data.comment).toBe(r.body.reply)
    expect(one.body.data.threadId).toBe(r.body.thread_id)
    expect(one.body.data.rubricKey).toBe('pt3_bm_karangan')
  })

  it('cikguNextReply overrides the next reply once, including an empty reply', async () => {
    m13Hooks.cikguNextReply('Baris 1\n<b>x</b>')
    const a = await send('hai')
    expect(a.body.reply).toBe('Baris 1\n<b>x</b>')
    m13Hooks.cikguNextReply('')
    const b = await send('hai')
    expect(b.body.reply).toBe('')
    expect(b.body.tokens.out).toBe(0)
    expect((await send('hai')).body.reply).toBe(GENERAL_REPLY)
    expect(() => m13Hooks.cikguNextReply(5 as unknown as string)).toThrow(TypeError)
  })

  it('answers 429 {quota_exhausted: true} at the limit and stores nothing (BR-M13-06)', async () => {
    m13Hooks.cikguSetTurnsUsed(GURU, 30)
    const before = cikgu.threadsOf(GURU).length
    const r = await send('hai')
    expect(r.status).toBe(429)
    expect(r.body).toEqual({ quota_exhausted: true })
    expect(cikgu.threadsOf(GURU)).toHaveLength(before)

    m13Hooks.cikguSetTurnsUsed(GURU, 29)
    const last = await send('hai')
    expect(last.status).toBe(200)
    expect(last.body.turns_remaining).toBe(0)
    expect((await send('hai')).status).toBe(429)
    expect(() => m13Hooks.cikguSetTurnsUsed(999_999_999, 1)).toThrow(RangeError)
    expect(() => m13Hooks.cikguSetTurnsUsed(GURU, -1)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------------------------
describe('#2-#4 RPH', () => {
  it('lists own RPHs by lesson date desc then id desc, with the observed admin mirror', async () => {
    const r = await call<
      ListBody<{ id: number; lessonDate: string; subjectName: string; status: string }>
    >('GET', '/api/cikgu/rph')
    expect(r.status).toBe(200)
    expect(r.body.data.map((x) => x.id)).toEqual([13101, 9_000_001, 13102])
    expect(r.body.data[0]).toEqual({
      id: 13101,
      lessonDate: '2026-09-28',
      subjectName: 'Kimia',
      level: 'T5',
      tajuk: 'Elektrolisis Larutan Akueus',
      status: 'generated',
    })
    expect(r.body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 })

    const admin = await call<ListBody<unknown>>('GET', '/api/cikgu/rph', { as: ADMIN })
    expect(admin.body.data).toEqual([])
    expect(admin.body.meta.totalItems).toBe(0)
  })

  it('shows the empty table with the pager for a page beyond the last', async () => {
    const r = await call<ListBody<unknown>>('GET', '/api/cikgu/rph?page=5')
    expect(r.body.data).toEqual([])
    expect(r.body.meta).toMatchObject({ page: 5, totalItems: 3 })
  })

  it('creates an RPH with the canned content (#3)', async () => {
    const r = await call<Data<Record<string, unknown>>>('POST', '/api/cikgu/rph', {
      body: {
        subjectName: ' Matematik ',
        level: 'T4',
        tajuk: 'Fungsi Kuadratik',
        className: '4 BESTARI',
        lessonDate: '2026-09-25',
        durationMinutes: 90,
        timeSlot: '10.00-11.30',
        tema: 'Algebra',
        pengajaranKeperluan: 'Kalkulator',
      },
    })
    expect(r.status).toBe(201)
    const rph = r.body.data
    expect(rph).toMatchObject({
      userId: GURU,
      subjectName: 'Matematik',
      level: 'T4',
      source: 'form',
      status: 'generated',
      threadId: null,
      durationMinutes: 90,
    })
    const content = rph.content as string
    expect(content).toContain('Kelas: 4 BESTARI')
    expect(content).toContain('Tarikh: 25/09/2026')
    expect(content).toContain('Set Induksi (9 minit)') // round(0.10 x 90)
    expect(content).toContain('Penutup (14 minit)') // round(0.15 x 90) = 14
    expect(content).toContain('Keperluan Khas: Kalkulator')
    expect(content.endsWith('Keperluan Khas: Kalkulator')).toBe(true)
  })

  it('defaults the date and duration, and orders by date then id', async () => {
    const r = await call<Data<{ id: number; lessonDate: string; durationMinutes: number }>>(
      'POST',
      '/api/cikgu/rph',
      { body: { subjectName: 'Sejarah', level: 'T2', tajuk: 'Bab 2' } },
    )
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({ lessonDate: '2026-09-25', durationMinutes: 60 })
    const list = await call<ListBody<{ id: number; lessonDate: string }>>('GET', '/api/cikgu/rph')
    // 13101 (28/09), chat RPH (26/09), then the 25/09 rows by id desc: new RPHs before 13102.
    expect(list.body.data.map((x) => x.lessonDate)).toEqual([
      '2026-09-28',
      '2026-09-26',
      '2026-09-25',
      '2026-09-25',
      '2026-09-25',
    ])
    expect(list.body.data.at(-1)?.id).toBe(13102)
  })

  it('rejects invalid input with 422 VALIDATION_ERROR (BR-M13-12)', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ level: 'T4', tajuk: 'x' }, 'subjectName'],
      [{ subjectName: 'a'.repeat(101), level: 'T4', tajuk: 'x' }, 'subjectName'],
      [{ subjectName: 'Kimia', level: 'T6', tajuk: 'x' }, 'level'],
      [{ subjectName: 'Kimia', tajuk: 'x' }, 'level'],
      [{ subjectName: 'Kimia', level: 'T4', tajuk: '  ' }, 'tajuk'],
      [{ subjectName: 'Kimia', level: 'T4', tajuk: 'a'.repeat(201) }, 'tajuk'],
      [{ subjectName: 'Kimia', level: 'T4', tajuk: 'x', durationMinutes: 14 }, 'durationMinutes'],
      [{ subjectName: 'Kimia', level: 'T4', tajuk: 'x', durationMinutes: 241 }, 'durationMinutes'],
      [{ subjectName: 'Kimia', level: 'T4', tajuk: 'x', durationMinutes: 60.5 }, 'durationMinutes'],
      [{ subjectName: 'Kimia', level: 'T4', tajuk: 'x', lessonDate: '2026-02-30' }, 'lessonDate'],
      [
        { subjectName: 'Kimia', level: 'T4', tajuk: 'x', pengajaranKeperluan: 'a'.repeat(501) },
        'pengajaranKeperluan',
      ],
      [{ subjectName: 'Kimia', level: 'T4', tajuk: 'x', tema: 'a'.repeat(101) }, 'tema'],
    ]
    const before = (await call<ListBody<unknown>>('GET', '/api/cikgu/rph')).body.meta.totalItems
    for (const [body, field] of cases) {
      const r = await call<ErrorBody>('POST', '/api/cikgu/rph', { body })
      expect(r.status, JSON.stringify(body)).toBe(422)
      expect(r.body.error.code).toBe('VALIDATION_ERROR')
      expect(Object.keys(r.body.error.fields ?? {})).toContain(field)
    }
    expect(
      (await call<ErrorBody>('POST', '/api/cikgu/rph', { body: {} })).body.error.fields
        ?.subjectName,
    ).toBe(VALIDATION_MSG.required)
    expect((await call<ListBody<unknown>>('GET', '/api/cikgu/rph')).body.meta.totalItems).toBe(
      before,
    )
  })

  it('returns an RPH to its owner only (#4, FR-M13-48)', async () => {
    const own = await call<Data<{ id: number; content: string; tajuk: string }>>(
      'GET',
      '/api/cikgu/rph/13101',
    )
    expect(own.status).toBe(200)
    expect(own.body.data).toMatchObject({ id: 13101, tajuk: 'Elektrolisis Larutan Akueus' })
    expect(own.body.data.content).toContain('Masa: 8.00-9.00 pagi')
    expect((await call('GET', '/api/cikgu/rph/13101', { as: ADMIN })).status).toBe(404)
    expect((await call('GET', '/api/cikgu/rph/1', { as: ADMIN })).status).toBe(404)
    expect((await call('GET', '/api/cikgu/rph/777777')).status).toBe(404)
    expect((await call('GET', '/api/cikgu/rph/abc')).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------------------------
describe('#5-#6 essays', () => {
  it('lists own markings newest first; the admin has none', async () => {
    const r = await call<ListBody<{ id: number; subjectName: string | null }>>(
      'GET',
      '/api/cikgu/essays',
    )
    expect(r.body.data.map((e) => e.id)).toEqual([9_000_001, 13202, 13201])
    expect(r.body.data[1]).toEqual({
      id: 13202,
      studentName: 'Murid Demo 02',
      subjectName: 'Sejarah',
      rubricKey: 'sejarah_essay',
      essayTitle: 'Semangat Patriotisme',
      marks: 14,
      maxMarks: 20,
      createdAt: '2026-09-24T21:00:00+08:00',
    })
    expect(
      (await call<ListBody<unknown>>('GET', '/api/cikgu/essays', { as: ADMIN })).body.data,
    ).toEqual([])
  })

  it('returns a marking to its owner only', async () => {
    const own = await call<Data<{ id: number; comment: string; essayText: string }>>(
      'GET',
      '/api/cikgu/essays/13201',
    )
    expect(own.status).toBe(200)
    expect(own.body.data.comment).toContain('Markah: 35/50')
    expect(own.body.data.essayText).toHaveLength(312)
    expect((await call('GET', '/api/cikgu/essays/13201', { as: ADMIN })).status).toBe(404)
    expect((await call('GET', '/api/cikgu/essays/2')).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------------------------
describe('#7-#10 PBD', () => {
  it('lists the 9 pending tags: the newer rollup first, then names A-Z', async () => {
    const r = await call<
      ListBody<{ id: number; studentName: string; skor: number; tp: number; sp: string }>
    >('GET', '/api/cikgu/pbd')
    expect(r.body.meta.totalItems).toBe(9)
    expect(r.body.data[0]).toMatchObject({
      id: 13311,
      studentId: 3003,
      classroomId: 2002,
      sp: '1.1.1',
      skor: 40,
      tp: 3,
    })
    const rest = r.body.data.slice(1)
    expect(rest.map((t) => t.id).sort()).toEqual([
      13301, 13302, 13303, 13304, 13305, 13306, 13307, 13308,
    ])
    const names = rest.map((t) => t.studentName)
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, 'ms', { sensitivity: 'base' })),
    )
    expect(names.every((n) => n !== '')).toBe(true)
    expect(
      (await call<ListBody<unknown>>('GET', '/api/cikgu/pbd', { as: ADMIN })).body.data,
    ).toEqual([])
  })

  it('exports the approved tags (#10)', async () => {
    const r = await call('GET', '/api/cikgu/pbd/export.csv')
    expect(r.status).toBe(200)
    expect(r.res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(r.res.headers['content-disposition']).toBe('attachment; filename="pbd-approved.csv"')
    const lines = (await (r.body as Blob).text()).trimEnd().split('\n')
    expect(lines[0]).toBe('pelajar,kelas,sp,skor,tp,tarikh_lulus')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toMatch(/,.+,1\.1\.1,80\.0,5,2026-09-24$/)
    expect(lines[2]).toMatch(/,.+,1\.1\.1,60\.0,4,2026-09-24$/)
    const admin = await call('GET', '/api/cikgu/pbd/export.csv', { as: ADMIN })
    expect((await (admin.body as Blob).text()).trimEnd()).toBe(
      'pelajar,kelas,sp,skor,tp,tarikh_lulus',
    )
  })

  it('approves only the own pending tags among the ids (#9, BR-M13-16)', async () => {
    const admin = await call<Data<{ approved: number }>>('POST', '/api/cikgu/pbd/bulk-approve', {
      as: ADMIN,
      body: { ids: [13301] },
    })
    expect(admin.body.data.approved).toBe(0)
    const r = await call<Data<{ approved: number }>>('POST', '/api/cikgu/pbd/bulk-approve', {
      body: { ids: [13301, '13302', 13309, 424242, 'x', 13301] },
    })
    expect(r.body.data).toEqual({ approved: 2 }) // 13309 already approved, others ignored
    expect(
      (
        await call<Data<{ approved: number }>>('POST', '/api/cikgu/pbd/bulk-approve', {
          body: { ids: [] },
        })
      ).body.data.approved,
    ).toBe(0)
    expect(
      (await call<Data<{ approved: number }>>('POST', '/api/cikgu/pbd/bulk-approve', { body: {} }))
        .body.data.approved,
    ).toBe(0)
    const queue = await call<ListBody<{ id: number }>>('GET', '/api/cikgu/pbd')
    expect(queue.body.meta.totalItems).toBe(7)
    const csv = await ((await call('GET', '/api/cikgu/pbd/export.csv')).body as Blob).text()
    expect(csv.trimEnd().split('\n')).toHaveLength(5)
  })

  it('changes nothing for a null or foreign class (#8, FR-M13-65)', async () => {
    const zero = { created: 0, updated: 0, skipped: 0 }
    expect(
      (await call<Data<unknown>>('POST', '/api/cikgu/pbd/rollup', { body: { classroomId: null } }))
        .body.data,
    ).toEqual(zero)
    expect(
      (await call<Data<unknown>>('POST', '/api/cikgu/pbd/rollup', { body: {} })).body.data,
    ).toEqual(zero)
    expect(
      (
        await call<Data<unknown>>('POST', '/api/cikgu/pbd/rollup', {
          body: { classroomId: 999999 },
        })
      ).body.data,
    ).toEqual(zero)
    // The admin owns no class; class 2001 is teacher 5's.
    expect(
      (
        await call<Data<unknown>>('POST', '/api/cikgu/pbd/rollup', {
          as: ADMIN,
          body: { classroomId: 2001 },
        })
      ).body.data,
    ).toEqual(zero)
  })

  it('rolls class 2001 up from the M05 Kimia answers: the designed scores come back (BR-M13-15, FR-M13-70)', async () => {
    const before = cikgu.pbdQueue(GURU, 1).rows.filter((t) => t.classroomId === 2001)
    const r = await call<Data<{ created: number; updated: number; skipped: number }>>(
      'POST',
      '/api/cikgu/pbd/rollup',
      {
        body: { classroomId: 2001 },
      },
    )
    expect(r.status).toBe(200)
    // 13301 and 13302 are approved now (skipped); the six other pending tags are updated in place.
    expect(r.body.data).toEqual({ created: 0, updated: 6, skipped: 2 })
    const after = cikgu.pbdQueue(GURU, 1).rows.filter((t) => t.classroomId === 2001)
    expect(after).toHaveLength(before.length)
    const by = (id: number) => after.find((t) => t.id === id)
    expect([13303, 13304, 13305, 13306].map((i) => [by(i)?.skor, by(i)?.tp])).toEqual(
      Array(4).fill([37.5, 2]),
    )
    expect([by(13307)?.skor, by(13307)?.tp]).toEqual([33.3, 2])
    expect([by(13308)?.skor, by(13308)?.tp]).toEqual([12.5, 1])
    // The rolled-up tags are now the newest of the queue.
    expect(cikgu.pbdQueue(GURU, 1).rows[0]?.classroomId).toBe(2001)
  })

  it('picks up a new Kimia answer of student 3008 through mock.addAnswer: 2/9 = 22.2 TP2 (XR-M13-03b)', async () => {
    const hooks = m05.hooks as unknown as {
      addAnswer: (i: { userId: number; questionId: number; isCorrect: boolean }) => unknown
    }
    hooks.addAnswer({ userId: 3008, questionId: 700001, isCorrect: true })
    const r = await call<Data<{ created: number; updated: number; skipped: number }>>(
      'POST',
      '/api/cikgu/pbd/rollup',
      {
        body: { classroomId: 2001 },
      },
    )
    expect(r.body.data).toEqual({ created: 0, updated: 6, skipped: 2 })
    const t = cikgu.pbdQueue(GURU, 1).rows.find((x) => x.id === 13308)
    expect([t?.skor, t?.tp]).toEqual([22.2, 2])
  })

  it('creates a pending tag for a student without one and leaves approved tags (class 2002)', async () => {
    const r = await call<Data<{ created: number; updated: number; skipped: number }>>(
      'POST',
      '/api/cikgu/pbd/rollup',
      {
        body: { classroomId: 2002 },
      },
    )
    const { created, updated, skipped } = r.body.data
    expect(skipped).toBe(2) // 13309, 13310 approved
    expect(updated).toBeGreaterThanOrEqual(1) // 13311
    expect(created + updated + skipped).toBeLessThanOrEqual(8)
    const again = await call<Data<{ created: number }>>('POST', '/api/cikgu/pbd/rollup', {
      body: { classroomId: 2002 },
    })
    expect(again.body.data.created).toBe(0) // idempotent
  })

  it('pages the queue at 20 per page', async () => {
    const r = await call<ListBody<unknown>>('GET', '/api/cikgu/pbd?page=2')
    expect(r.body.meta.pageSize).toBe(20)
    expect(r.body.data).toEqual([])
  })
})
