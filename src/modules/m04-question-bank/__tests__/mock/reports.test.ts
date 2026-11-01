/**
 * M04-T6a/b/c: the report endpoints #14–#17 (SRS §7, BR-M04-11…16): guards, the create transaction and
 * the 3-report rule, 404 / 422, the admin actions and the display statuses of the §6.11 seed.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type {
  MyReportListMeta,
  ReportCreated,
  ReportListMeta,
  ReportUpdated,
  ReportView,
} from '../../api/reports'
import { questions, reports, structured } from '../../mock'
import { setPlacingPapers } from '../../mock/handlers/reports'
import {
  REPORT_COMMENT_MESSAGE,
  REPORT_REASONS_MESSAGE,
  REPORT_REASON_INVALID_MESSAGE,
  REPORT_SOURCE_MESSAGE,
  REPORT_STATUS_MESSAGE,
  REPORT_UPDATED_TEXT,
} from '../../mock/handlers/reports'
import { PELAJAR_DEMO } from '../../mock/seeds/reports'
import {
  ADMIN,
  bootM04,
  callAs,
  GURU,
  PELAJAR,
  type Call,
  type ErrorBody,
} from './workflow-helpers'

interface List<T, M extends object> {
  data: T[]
  meta: { totalItems: number } & M
}

let runtime: MockRuntime
let call: Call
let dirty = false

beforeAll(async () => {
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
}, 180_000)

afterAll(async () => {
  await runtime.reset()
})

const fieldsOf = (r: { body: unknown }) => (r.body as ErrorBody).error.fields
const adminList = (query = '') =>
  call<List<ReportView, ReportListMeta>>('GET', `/api/question-reports${query}`, ADMIN)

describe('guards', () => {
  it('#14 and #16 are admin only; #15 and #17 need a session', async () => {
    expect((await call('GET', '/api/question-reports', null)).status).toBe(401)
    expect((await call('GET', '/api/question-reports', PELAJAR)).status).toBe(403)
    expect((await call('GET', '/api/question-reports', GURU)).status).toBe(403)
    expect(
      (await call('PATCH', '/api/question-reports/10', PELAJAR, { status: 'fixed' })).status,
    ).toBe(403)
    expect(
      (await call('PATCH', '/api/question-reports/10', null, { status: 'fixed' })).status,
    ).toBe(401)
    expect((await call('POST', '/api/question-reports', null, {})).status).toBe(401)
    expect((await call('GET', '/api/question-reports/mine', null)).status).toBe(401)
  })

  it('a refused PATCH changes nothing', async () => {
    await call('PATCH', '/api/question-reports/10', PELAJAR, { status: 'fixed' })
    expect(reports.get(10)?.status).toBe('pending')
  })
})

describe('#14 S7 list (FR-M04-72…78, E2E-M04-39/40)', () => {
  it('defaults to pending, newest first, with counts 2 / 3 / 5 / 1 / 11', async () => {
    const r = await adminList()
    expect(r.status).toBe(200)
    expect(r.body.data.map((x) => x.id)).toEqual([10, 9])
    expect(r.body.meta.activeTab).toBe('pending')
    expect(r.body.meta.counts).toEqual({ pending: 2, reviewed: 3, fixed: 5, dismissed: 1, all: 11 })
  })

  it('filters by tab, all lists 11, an unknown status is empty with no active tab', async () => {
    expect((await adminList('?status=reviewed')).body.data.map((x) => x.id)).toEqual([6, 4, 3])
    expect((await adminList('?status=dismissed')).body.data.map((x) => x.id)).toEqual([11])
    expect((await adminList('?status=all')).body.data).toHaveLength(11)
    const unknown = await adminList('?status=zzz')
    expect(unknown.body.data).toEqual([])
    expect(unknown.body.meta.activeTab).toBeNull()
    expect(unknown.body.meta.counts.all).toBe(11)
  })

  it('derives the labels, category and display status (BR-M04-14/15, DV-M04-08)', async () => {
    const byId = new Map((await adminList('?status=all')).body.data.map((x) => [x.id, x]))
    const six = byId.get(6)
    expect(six).toMatchObject({
      displayStatus: 'reviewed',
      category: 'Tak Jelas',
      reasonLabels: ['Soalan mengelirukan'],
      roomCode: 'Y31OBA',
      question: { exists: true, type: 'mcq', isActive: false },
    })
    expect(six?.question.practiceUrl).toMatch(
      /^\/spm\/latih-tubi\/[A-Z0-9_]+\/quiz\?question_id=136891&count=1$/,
    )
    expect(six?.question.options).toHaveLength(4)
    expect(byId.get(4)?.reasonLabels).toEqual(['Markah tidak adil'])
    expect(byId.get(4)?.category).toBe('Jawapan Salah')
    expect(byId.get(3)?.reasonLabels).toEqual(['Skema jawapan tidak tepat'])
    expect(byId.get(10)?.question.practiceUrl).toBe('/latihan-berstruktur/3698/jawab?scope=spm')
    expect(byId.get(10)?.reporter.name).toBeTruthy()
    // fixed + inactive question = "Dikeluarkan"; fixed + the question gone = "Diperbaiki".
    expect(byId.get(2)?.displayStatus).toBe('removed')
    expect(byId.get(1)?.question.exists).toBe(false)
    expect(byId.get(1)?.displayStatus).toBe('fixed')
    expect(byId.get(11)?.displayStatus).toBe('dismissed')
  })
})

describe('#15 create (BR-M04-11/12, FR-M04-69…71)', () => {
  const post = (body: unknown, as: number | null = PELAJAR) =>
    call<ReportCreated>('POST', '/api/question-reports', as, body)

  it('an MCQ report: 201, stored pending, the question inactive at once', async () => {
    dirty = true
    expect(questions.get(564_161)?.isActive).toBe(true)
    const r = await post({
      questionId: 564_161,
      reasons: ['wrong_answer', 'typo'],
      comment: 'Jawapan salah',
      source: 'spm',
      quizSessionId: 'sess-1',
    })
    expect(r.status).toBe(201)
    expect(r.body).toEqual({ success: true, message: 'Laporan berjaya dihantar.' })
    expect(questions.get(564_161)?.isActive).toBe(false)
    const mine = reports.mine(PELAJAR)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({
      status: 'pending',
      questionType: 'mcq',
      reasons: ['wrong_answer', 'typo'],
      comment: 'Jawapan salah',
      source: 'spm',
      quizSessionId: 'sess-1',
      reporterId: PELAJAR,
    })
    const tab = await adminList()
    expect(tab.body.meta.counts.pending).toBe(3)
    expect(tab.body.data[0]).toMatchObject({ id: mine[0]?.id, question: { isActive: false } })
  })

  it('defaults the source per variant and accepts the other sources and `outdated`', async () => {
    dirty = true
    expect((await post({ questionId: 564_159, reasons: ['other'] })).status).toBe(201)
    expect(reports.mine(PELAJAR)[0]?.source).toBe('spm')
    expect(
      (await post({ questionId: 4_455, questionType: 'structured', reasons: ['other'] })).status,
    ).toBe(201)
    expect(reports.mine(PELAJAR)[0]?.source).toBe('structured_attempt')
    for (const source of ['latihan', 'revision', 'teacher_databank']) {
      expect((await post({ questionId: 564_158, reasons: ['outdated'], source })).status).toBe(201)
    }
    const labels = (await adminList()).body.data.find((x) => x.reasons[0] === 'outdated')
    expect(labels).toMatchObject({
      reasonLabels: ['Soalan sudah tidak relevan'],
      category: 'Lain-lain',
    })
  })

  it('a structured question stays active for 2 reports and goes inactive at the 3rd', async () => {
    dirty = true
    const before = reports
      .list()
      .filter((r) => r.questionId === 4_455 && r.questionType === 'structured')
    expect(before).toHaveLength(0)
    const send = () =>
      post({ questionId: 4_455, questionType: 'structured', reasons: ['wrong_answer'] })
    await send()
    await send()
    expect(structured.get(4_455)?.isActive).toBe(true)
    await send()
    expect(structured.get(4_455)?.isActive).toBe(false)
  })

  it('422: no reason, a reason of the other variant, a bad source, a long comment', async () => {
    const none = await post({ questionId: 564_161, reasons: [] })
    expect(none.status).toBe(422)
    expect(fieldsOf(none)).toEqual({ reasons: REPORT_REASONS_MESSAGE })
    const wrongSet = await post({
      questionId: 4_455,
      questionType: 'structured',
      reasons: ['duplicate'],
    })
    expect(fieldsOf(wrongSet)).toEqual({ reasons: REPORT_REASON_INVALID_MESSAGE })
    expect(fieldsOf(await post({ questionId: 564_161, reasons: ['other'], source: 'x' }))).toEqual({
      source: REPORT_SOURCE_MESSAGE,
    })
    expect(
      fieldsOf(await post({ questionId: 564_161, reasons: ['other'], comment: 'x'.repeat(501) })),
    ).toEqual({ comment: REPORT_COMMENT_MESSAGE })
    expect(reports.mine(PELAJAR)).toHaveLength(0)
    expect(questions.get(564_161)?.isActive).toBe(true)
  })

  it('422 for a quizSessionId or roomCode that is too long or has a bad format', async () => {
    const base = { questionId: 564_161, reasons: ['other'] }
    expect(fieldsOf(await post({ ...base, quizSessionId: 'x'.repeat(65) }))).toHaveProperty(
      'quizSessionId',
    )
    expect(fieldsOf(await post({ ...base, roomCode: 'a b<script>' }))).toHaveProperty('roomCode')
    expect(fieldsOf(await post({ ...base, quizSessionId: 12 }))).toHaveProperty('quizSessionId')
    expect(
      (await post({ ...base, quizSessionId: 'x'.repeat(64), roomCode: 'Y31OBA' })).status,
    ).toBe(201)
    dirty = true
  })

  it('404 for an unknown question; nothing is stored', async () => {
    expect((await post({ questionId: 99_999_999, reasons: ['other'] })).status).toBe(404)
    expect(
      (await post({ questionId: 99_999_999, questionType: 'structured', reasons: ['other'] }))
        .status,
    ).toBe(404)
    expect(reports.mine(PELAJAR)).toHaveLength(0)
  })
})

describe('#16 update (BR-M04-13, FR-M04-79…81)', () => {
  const patch = (id: number, body: unknown) =>
    call<ReportUpdated>('PATCH', `/api/question-reports/${String(id)}`, ADMIN, body)

  it('"Tandakan Selesai": fixed with the notes, the question untouched', async () => {
    dirty = true
    const r = await patch(10, { status: 'fixed', adminNotes: 'Soalan diperbaiki' })
    expect(r.status).toBe(200)
    expect(r.body.status).toBe(REPORT_UPDATED_TEXT)
    expect(r.body.data).toMatchObject({ id: 10, status: 'fixed', adminNotes: 'Soalan diperbaiki' })
    expect((await adminList()).body.meta.counts).toMatchObject({ pending: 1, fixed: 6 })
  })

  it('"Tolak & Aktifkan Semula" reactivates the question; "Nyahaktif Segera" deactivates it', async () => {
    dirty = true
    expect(questions.get(136_891)?.isActive).toBe(false)
    const dismissed = await patch(6, {
      status: 'dismissed',
      adminNotes: 'Soalan dan jawapan disemak — tiada masalah',
      reactivate: true,
    })
    expect(dismissed.status).toBe(200)
    expect(questions.get(136_891)?.isActive).toBe(true)
    expect(reports.get(6)).toMatchObject({ status: 'dismissed' })

    expect(structured.get(3_698)?.isActive).toBe(true)
    await patch(10, {
      status: 'reviewed',
      adminNotes: 'Dinyahaktifkan segera oleh admin',
      forceDeactivate: true,
    })
    expect(structured.get(3_698)?.isActive).toBe(false)
    expect(reports.get(10)).toMatchObject({ status: 'reviewed' })
  })

  it('"Arkib" (archive: true) archives an MCQ and sets the report reviewed (R1-B17)', async () => {
    dirty = true
    expect(questions.get(136_891)?.status).not.toBe('archived')
    const r = await patch(6, { status: 'reviewed', adminNotes: 'Diarkibkan oleh admin', archive: true })
    expect(r.status).toBe(200)
    expect(questions.get(136_891)?.status).toBe('archived')
    expect(reports.get(6)).toMatchObject({ status: 'reviewed' })
  })

  it('archive on a question placed on a published paper returns the warning and papers (H-A13)', async () => {
    dirty = true
    setPlacingPapers(136_891, [{ id: '7', title: 'Percubaan A' }])
    const r = await patch(6, { status: 'reviewed', archive: true })
    expect(r.body.data).toMatchObject({ papers: [{ id: '7', title: 'Percubaan A' }] })
    expect(r.body.data.warning).toContain('Murid tidak boleh memulakan percubaan baharu')
    setPlacingPapers(136_891, [])
  })

  it('an omitted adminNotes keeps the note; an empty one clears it', async () => {
    dirty = true
    await patch(3, { status: 'fixed' })
    expect(reports.get(3)?.adminNotes).toBe('Dinyahaktifkan segera oleh admin')
    await patch(3, { status: 'fixed', adminNotes: '  ' })
    expect(reports.get(3)?.adminNotes).toBeNull()
  })

  it('404 for an unknown report; 422 for a bad status or long notes', async () => {
    expect((await patch(999, { status: 'fixed' })).status).toBe(404)
    expect(fieldsOf(await patch(10, { status: 'pending' }))).toEqual({
      status: REPORT_STATUS_MESSAGE,
    })
    expect((await patch(10, {})).status).toBe(422)
    expect(
      fieldsOf(await patch(10, { status: 'fixed', adminNotes: 'x'.repeat(1001) })),
    ).toHaveProperty('adminNotes')
    expect(reports.get(10)?.status).toBe('pending')
  })
})

describe('#17 mine (FR-M04-82, E2E-M04-44)', () => {
  it('lists only the caller’s reports with counts, without the question content', async () => {
    const asOwner = runtimeUser(PELAJAR_DEMO(1))
    const r = await asOwner()
    expect(r.status).toBe(200)
    expect(r.body.data.map((x) => x.id)).toEqual([10, 6, 2])
    expect(r.body.meta.counts).toEqual({ pending: 1, reviewed: 1, fixed: 1, dismissed: 0, all: 3 })
    for (const row of r.body.data) {
      expect(row.question.text).toBeUndefined()
      expect(row.question.options).toBeUndefined()
      expect(row.question.practiceUrl).toBeUndefined()
    }
    expect(r.body.data[2]).toMatchObject({ displayStatus: 'removed', reasonLabels: ['Lain-lain'] })
  })

  it('a user without reports and the admin get an empty list with zero counts', async () => {
    for (const who of [PELAJAR_DEMO(5), ADMIN, PELAJAR]) {
      const r = await runtimeUser(who)()
      expect(r.body.data).toEqual([])
      expect(r.body.meta.counts).toEqual({
        pending: 0,
        reviewed: 0,
        fixed: 0,
        dismissed: 0,
        all: 0,
      })
    }
  })

  it('a report just sent shows up in the sender’s list', async () => {
    dirty = true
    await call('POST', '/api/question-reports', PELAJAR, { questionId: 564_161, reasons: ['typo'] })
    const r = await runtimeUser(PELAJAR)()
    expect(r.body.data).toHaveLength(1)
    expect(r.body.data[0]).toMatchObject({
      status: 'pending',
      reasonLabels: ['Kesalahan ejaan / taip'],
    })
    expect(r.body.meta.counts).toMatchObject({ pending: 1, all: 1 })
  })
})

function runtimeUser(as: number) {
  return () => call<List<ReportView, MyReportListMeta>>('GET', '/api/question-reports/mine', as)
}
