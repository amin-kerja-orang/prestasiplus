import { PERFORMANCE_HEADCOUNT_MESSAGES as MSG } from '@pp/contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../../src/common/errors/api-error'
import { FixedClock } from '../../../../src/db/clock'
import { HeadcountFactsService } from '../../../../src/modules/reports/performance/headcount/headcount-facts.service'
import { HeadcountService, type HeadcountWriteCtx } from '../../../../src/modules/reports/performance/headcount/headcount.service'
import { PerformancePorts } from '../../../../src/modules/reports/performance/ports'
import type { Ctx } from '../../../../src/modules/reports/performance/services/types'
import { InMemoryAnswerFacts } from '../fakes/in-memory-answer-facts'
import { InMemoryClasses } from '../fakes/in-memory-classes'
import { InMemoryDirectory } from '../fakes/in-memory-directory'
import { InMemoryHeadcountRepo } from '../fakes/in-memory-headcount-repo'

const NOW = '2026-11-05T10:00:00+08:00'

function world() {
  const repo = new InMemoryHeadcountRepo()
  const directory = new InMemoryDirectory()
  directory.addPupil({ id: 't1', name: 'Cikgu Contoh', schoolId: 's1', isStudent: false })
  directory.addPupil({ id: 't2', name: 'Cikgu Lain', schoolId: 's2', isStudent: false })
  for (const id of ['p1', 'p2', 'p3']) directory.addPupil({ id, name: `Murid ${id}`, schoolId: 's1' })
  directory.addPupil({ id: 'p9', name: 'Murid p9', schoolId: 's2' })
  directory.addSchool({ id: 's1' })
  const classes = new InMemoryClasses()
    .add({ id: 'c1', schoolId: 's1', teacherId: 't1' }, ['p1', 'p2', 'p3'])
    .add({ id: 'c2', schoolId: 's2', teacherId: 't2' }, ['p9'])
  const answers = new InMemoryAnswerFacts()
  const ports = new PerformancePorts(undefined, classes, undefined, undefined, undefined, answers)
  const audit = { record: vi.fn<(e: Record<string, unknown>) => Promise<undefined>>(async () => undefined) }
  const prisma = { transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}) }
  const service = new HeadcountService(repo.asRepo(), ports, directory, prisma as never, audit as never, new FixedClock(NOW))
  const facts = new HeadcountFactsService(repo.asRepo(), ports)
  return { repo, directory, classes, answers, ports, audit, service, facts }
}

const ctx = (userId: string, role: Ctx['role'], schoolId = 's1'): Ctx => ({
  userId,
  role,
  scope: role === 'admin' ? { level: 'national', label: 'x' } : { level: 'school', schoolId, label: 'x' },
  isTest: false,
})
const wctx = (userId: string, role: Ctx['role'], schoolId = 's1'): HeadcountWriteCtx => ({
  ...ctx(userId, role, schoolId),
  requestId: 'r',
  ip: '127.0.0.1',
  sessionRowId: '1',
  scopeLevel: 'school',
})
const status = async (p: Promise<unknown>): Promise<number> => {
  try {
    await p
    return 200
  } catch (e) {
    return e instanceof ApiError ? e.getStatus() : 500
  }
}
const lineOf = (d: Awaited<ReturnType<HeadcountService['detail']>>, id: string) => d.rows.find((r) => r.userId === id)

let w: ReturnType<typeof world>
let manual: string
let auto: string
let foreign: string
beforeEach(() => {
  w = world()
  manual = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual' }).id
  auto = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'auto', subjectId: '2' }).id
  foreign = w.repo.addConfig({ teacherId: 't2', classroomId: 'c2', mode: 'manual' }, 's2').id
})

describe('list and dashboard scope per role', () => {
  it('teacher: own; school admin: own school; admin: all; a pupil: none', async () => {
    expect((await w.service.list(ctx('t1', 'teacher'))).map((c) => c.id).sort()).toEqual([manual, auto].sort())
    expect((await w.service.list(ctx('a1', 'school_admin', 's1'))).map((c) => c.id).sort()).toEqual([manual, auto].sort())
    expect((await w.service.list(ctx('a2', 'school_admin', 's2'))).map((c) => c.id)).toEqual([foreign])
    expect(await w.service.list(ctx('a3', 'school_admin', 's9'))).toEqual([])
    // S6-T13 PM-24: the admin lists ONE school (`schoolId`, a canonical id; the HTTP spec covers the success path)
    await expect(w.service.list(ctx('ad', 'admin'))).rejects.toMatchObject({ fields: { schoolId: 'Sila pilih sekolah.' } })
    expect((await w.service.dashboard(ctx('a1', 'school_admin', 's1'))).configs).toHaveLength(2)
    expect((await w.service.dashboard(ctx('ad', 'admin'))).configs).toHaveLength(3)
  })

  it('the list carries the teacher name', async () => {
    const list = await w.service.list(ctx('a1', 'school_admin'))
    expect(list.every((c) => c.teacherName === 'Cikgu Contoh')).toBe(true)
    expect((await w.service.dashboard(ctx('t1', 'teacher'))).configs[0]?.teacherName).toBe('Cikgu Contoh')
  })
})

describe('OTR targets are computed, the stored target is ignored', () => {
  it('worked example: TOV 40, ETR 80, n = 3, AR 60 gives 53 / 66 / 80, Below, Sederhana', async () => {
    w.repo.addEntry(manual, 'p1', { tov: 40, etr: 80, actuals: new Map([[1, 60], [2, 60], [3, 60]]), legacyTargets: new Map([[1, 99], [2, 99], [3, 99]]) })
    const d = await w.service.detail(ctx('t1', 'teacher'), manual, undefined)
    const row = lineOf(d, 'p1')
    expect(row?.cells.map((c) => c.target)).toEqual([53, 66, 80])
    expect(row?.status).toBe('below')
    expect(row?.projection).toMatchObject({ confidence: 'Sederhana', value: 80, trend: 'Meningkat' })
    const s = await w.service.student(ctx('t1', 'teacher'), 'p1')
    expect(s.sections[0]).toMatchObject({ status: 'below', jurang: 40, unjuran: 80, keyakinan: 'Sederhana', entryStatus: 'active', statusReason: null })
    expect(s.sections[0]?.rows.map((r) => r.target)).toEqual([53, 66, 80])
  })

  it('class defaults fill an entry without own values; an own value wins', async () => {
    w.repo.configs.find((c) => c.id === manual)!.defaultTov = 40
    w.repo.configs.find((c) => c.id === manual)!.defaultEtr = 80
    w.repo.addEntry(manual, 'p1')
    w.repo.addEntry(manual, 'p2', { tov: 50 })
    const d = await w.service.detail(ctx('t1', 'teacher'), manual, undefined)
    expect(lineOf(d, 'p1')).toMatchObject({ tov: 40, etr: 80, entryStatus: 'active' })
    expect(lineOf(d, 'p2')).toMatchObject({ tov: 50, etr: 80 })
    // p3 has no entry row at all: the default still applies.
    expect(lineOf(d, 'p3')).toMatchObject({ tov: 40, etr: 80 })
    expect(d.config).toMatchObject({ defaultTov: 40, defaultEtr: 80, mode: 'manual' })
  })

  it('no ETR: Draft and "belum_ada_data"; an ETR without a TOV: "belum_ada_tov" with no targets', async () => {
    w.repo.addEntry(manual, 'p1', { tov: 40 })
    w.repo.addEntry(manual, 'p2', { etr: 80, actuals: new Map([[1, 70]]) })
    const d = await w.service.detail(ctx('t1', 'teacher'), manual, undefined)
    expect(lineOf(d, 'p1')).toMatchObject({ entryStatus: 'draft', statusReason: 'belum_ada_data', status: 'none' })
    expect(lineOf(d, 'p2')).toMatchObject({ entryStatus: 'active', statusReason: 'belum_ada_tov', status: 'none' })
    expect(lineOf(d, 'p2')?.cells.map((c) => c.target)).toEqual([null, null, null])
  })

  it('chips, On Track % and the Ringkasan bands use the one rule', async () => {
    // OTR1 for TOV 40 / ETR 80 / n 3 = 53.
    w.repo.addEntry(manual, 'p1', { tov: 40, etr: 80, actuals: new Map([[1, 56]]) }) // +3 above
    w.repo.addEntry(manual, 'p2', { tov: 40, etr: 80, actuals: new Map([[1, 54]]) }) // +1 on
    w.repo.addEntry(manual, 'p3', { tov: 40, etr: 80, actuals: new Map([[1, 52]]) }) // below
    const d = await w.service.detail(ctx('t1', 'teacher'), manual, undefined)
    expect(d.chips).toMatchObject({ onTrack: 2, below: 1, empty: 0, onTrackPct: 67 })
    const s = await w.service.summary(ctx('t1', 'teacher'), manual)
    expect(s.otrs[0]).toMatchObject({ above: 1, onTrack: 1, below: 1, na: 0 })
  })
})

describe('Auto AR from the answer store', () => {
  const day = (iso: string) => new Date(iso)

  it('AR = round(correct / attempts * 100) over every mode of the subject and year; 0 attempts is null; same AR at every checkpoint', async () => {
    w.answers.addMany('p1', 4, 3, { mode: 'practice', answeredAt: day('2026-03-01T10:00:00+08:00'), subjectId: '2' })
    w.answers.addMany('p1', 2, 2, { mode: 'quiz', answeredAt: day('2026-04-01T10:00:00+08:00'), subjectId: '2', questionId: 'x' })
    // another subject and another year never count
    w.answers.addMany('p1', 10, 0, { mode: 'practice', answeredAt: day('2026-03-01T10:00:00+08:00'), subjectId: '3' })
    w.answers.addMany('p1', 10, 0, { mode: 'practice', answeredAt: day('2025-12-31T23:59:59+08:00'), subjectId: '2' })
    w.answers.addMany('p2', 3, 1, { mode: 'practice', answeredAt: day('2026-01-01T00:00:00+08:00'), subjectId: '2' })
    w.repo.addEntry(auto, 'p1', { tov: 40, etr: 80, actuals: new Map([[1, 5]]) }) // the stored actual is ignored in Auto
    const d = await w.service.detail(ctx('t1', 'teacher'), auto, undefined)
    // p1: 5 of 6 correct = 83, p2: 1 of 3 = 33, p3: no answers
    expect(lineOf(d, 'p1')?.cells.map((c) => c.ar)).toEqual([83, 83, 83])
    expect(lineOf(d, 'p2')?.cells.map((c) => c.ar)).toEqual([33, 33, 33])
    expect(lineOf(d, 'p3')?.cells.map((c) => c.ar)).toEqual([null, null, null])
  })

  it('one answer-store call per (subject, year) group over the rosters', async () => {
    w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'auto', subjectId: '2', academicYear: 2026 })
    const spy = vi.spyOn(w.ports.answerFacts, 'answerFacts')
    await w.service.list(ctx('t1', 'teacher'))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ subjectId: '2', from: new Date('2026-01-01T00:00:00+08:00'), to: new Date('2027-01-01T00:00:00+08:00') })
  })

  it('the facts reader agrees with the table, with or without an entry row', async () => {
    w.answers.addMany('p1', 4, 3, { mode: 'practice', answeredAt: day('2026-03-01T10:00:00+08:00'), subjectId: '2' })
    w.repo.configs.find((c) => c.id === auto)!.defaultTov = 40
    w.repo.configs.find((c) => c.id === auto)!.defaultEtr = 80
    const views = await w.facts.entriesInScope({ kind: 'teacher', teacherId: 't1' })
    const p1 = views.find((v) => v.configId === auto && v.studentId === 'p1')
    expect(p1).toMatchObject({ tov: 40, etr: 80, targets: [53, 66, 80], actuals: [75, 75, 75] })
  })

  it('the per-student path lists only that pupil; teacher and school scopes still list the whole Auto class', async () => {
    w.answers.addMany('p1', 4, 3, { mode: 'practice', answeredAt: day('2026-03-01T10:00:00+08:00'), subjectId: '2' })
    w.answers.addMany('p2', 3, 1, { mode: 'practice', answeredAt: day('2026-03-01T10:00:00+08:00'), subjectId: '2' })
    w.repo.addEntry(auto, 'p1', { tov: 40, etr: 80 })
    const ofP1 = (await w.facts.entriesOfStudent('p1', { kind: 'platform' })).filter((v) => v.configId === auto)
    expect(ofP1.map((v) => v.studentId)).toEqual(['p1'])
    const ofP1Teacher = await w.facts.entriesOfStudent('p1', { kind: 'teacher', teacherId: 't1' })
    expect(ofP1Teacher.every((v) => v.studentId === 'p1')).toBe(true)
    const ofP1School = await w.facts.entriesOfStudent('p1', { kind: 'school', schoolId: 's1' })
    expect(ofP1School.every((v) => v.studentId === 'p1')).toBe(true)
    const names = (v: { configId: string; studentId: string }[]) => v.filter((x) => x.configId === auto).map((x) => x.studentId).sort()
    expect(names(await w.facts.entriesInScope({ kind: 'teacher', teacherId: 't1' }))).toEqual(['p1', 'p2', 'p3'])
    expect(names(await w.facts.entriesInScope({ kind: 'school', schoolId: 's1' }))).toEqual(['p1', 'p2', 'p3'])
    expect(names(await w.facts.entriesOfClasses(['c1']))).toEqual(['p1', 'p2', 'p3'])
  })
})

describe('writes belong to the owning teacher', () => {
  it('school_admin and admin get 403 on every write, a foreign teacher 404', async () => {
    const calls = (c: HeadcountWriteCtx, id: string) => [
      w.service.saveAr(c, id, { checkpoint: 1, marks: [] }),
      w.service.saveTov(c, id, { rows: [] }),
      w.service.saveSettings(c, id, { activeOtrs: 3 }),
      w.service.saveDefaults(c, id, { defaultTov: null, defaultEtr: null }),
      w.service.reset(c, id),
      w.service.dropStudents(c, id, { action: 'drop', studentIds: ['p1'] }),
      w.service.remove(c, id),
    ]
    for (const role of ['school_admin', 'admin'] as const) {
      for (const p of calls(wctx('a1', role), manual)) expect(await status(p)).toBe(403)
    }
    expect(await status(w.service.create(wctx('a1', 'school_admin'), {}))).toBe(403)
    expect(await status(w.service.autoSetup(wctx('ad', 'admin'), { levels: ['T4'] }))).toBe(403)
    for (const p of calls(wctx('t1', 'teacher'), foreign)) expect(await status(p)).toBe(404)
    // an admin of another school cannot even tell the config exists
    expect(await status(w.service.saveDefaults(wctx('a2', 'school_admin', 's2'), manual, { defaultTov: 1, defaultEtr: 2 }))).toBe(404)
    expect(w.repo.configs).toHaveLength(3)
  })
})

describe('Key-in AR (Manual)', () => {
  it('saves with one decimal and answers the updated detail', async () => {
    const d = await w.service.saveAr(wctx('t1', 'teacher'), manual, { checkpoint: 1, marks: [{ userId: 'p1', value: 66.5 }, { userId: 'p2', value: null }] })
    expect(lineOf(d, 'p1')?.cells[0]?.ar).toBe(66.5)
    expect(lineOf(d, 'p2')?.cells[0]?.ar).toBeNull()
    expect(w.repo.entry(manual, 'p1')?.actuals.get(1)).toBe(66.5)
  })

  it('a value outside 0..100 is a 422 with the exact message and nothing is saved', async () => {
    const err = await w.service.saveAr(wctx('t1', 'teacher'), manual, { checkpoint: 1, marks: [{ userId: 'p1', value: 101 }] }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).getStatus()).toBe(422)
    expect((err as ApiError).fields).toEqual({ 'marks.0.value': MSG.markRange })
    expect(w.repo.entry(manual, 'p1')).toBeUndefined()
  })

  it('Auto config and a checkpoint outside 1..activeOtrs are 404; an unknown or dropped pupil is 422', async () => {
    expect(await status(w.service.saveAr(wctx('t1', 'teacher'), auto, { checkpoint: 1, marks: [] }))).toBe(404)
    expect(await status(w.service.saveAr(wctx('t1', 'teacher'), manual, { checkpoint: 4, marks: [] }))).toBe(404)
    expect(await status(w.service.saveAr(wctx('t1', 'teacher'), manual, { checkpoint: 0, marks: [] }))).toBe(404)
    expect(await status(w.service.saveAr(wctx('t1', 'teacher'), manual, { checkpoint: 1, marks: [{ userId: 'p9', value: 50 }] }))).toBe(422)
    w.repo.addEntry(manual, 'p3', { dropped: true })
    expect(await status(w.service.saveAr(wctx('t1', 'teacher'), manual, { checkpoint: 1, marks: [{ userId: 'p3', value: 50 }] }))).toBe(422)
  })
})

describe('Edit TOV / ETR / RS', () => {
  it('writes only the keys present; null clears', async () => {
    w.repo.addEntry(manual, 'p1', { tov: 40, etr: 80 })
    const d = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', tov: 45.5 }, { userId: 'p2', etr: 70 }] })
    expect(lineOf(d, 'p1')).toMatchObject({ tov: 45.5, etr: 80 })
    expect(lineOf(d, 'p2')).toMatchObject({ tov: null, etr: 70 })
    const cleared = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', etr: null }] })
    expect(lineOf(cleared, 'p1')?.etr).toBeNull()
  })

  it('RS date: defaults to the MYT day of the first save, a future date is 422, rs null clears the date', async () => {
    const first = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', rs: 78 }] })
    expect(lineOf(first, 'p1')).toMatchObject({ rs: 78, rsRecordedAt: '2026-11-05' })
    // a later save of the same RS keeps the recorded date
    w.repo.entry(manual, 'p1')!.rsRecordedAt = new Date('2026-10-01T00:00:00+08:00')
    const again = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', rs: 79 }] })
    expect(lineOf(again, 'p1')).toMatchObject({ rs: 79, rsRecordedAt: '2026-10-01' })
    const dated = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', rsRecordedAt: '2026-09-15' }] })
    expect(lineOf(dated, 'p1')?.rsRecordedAt).toBe('2026-09-15')
    const err = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', rs: 80, rsRecordedAt: '2026-11-06' }] }).catch((e: unknown) => e)
    expect((err as ApiError).getStatus()).toBe(422)
    expect((err as ApiError).fields).toEqual({ 'rows.0.rsRecordedAt': MSG.rsDateFuture })
    const cleared = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', rs: null }] })
    expect(lineOf(cleared, 'p1')).toMatchObject({ rs: null, rsRecordedAt: null })
  })

  it('an impossible date is 422 "Tarikh tidak sah." on that row, never a rollover or a 500', async () => {
    for (const rsRecordedAt of ['2025-13-01', '2026-02-31']) {
      const err = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', rs: 70, rsRecordedAt }] }).catch((e: unknown) => e)
      expect((err as ApiError).getStatus(), rsRecordedAt).toBe(422)
      expect((err as ApiError).fields, rsRecordedAt).toEqual({ 'rows.0.rsRecordedAt': MSG.rsDateInvalid })
    }
    expect(w.repo.entry(manual, 'p1')).toBeUndefined()
  })

  it('a date while the resulting RS is empty is 422 "Tarikh Rekod RS memerlukan RS."', async () => {
    const expectNeedsRs = async (rows: object[]) => {
      const err = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows }).catch((e: unknown) => e)
      expect((err as ApiError).getStatus()).toBe(422)
      expect((err as ApiError).fields).toEqual({ 'rows.0.rsRecordedAt': MSG.rsDateNeedsRs })
    }
    await expectNeedsRs([{ userId: 'p1', rsRecordedAt: '2026-09-15' }])
    await expectNeedsRs([{ userId: 'p1', rs: null, rsRecordedAt: '2026-09-15' }])
    // with a stored RS the date alone is fine
    w.repo.addEntry(manual, 'p2', { rs: 60 })
    const ok = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p2', rsRecordedAt: '2026-09-15' }] })
    expect(lineOf(ok, 'p2')?.rsRecordedAt).toBe('2026-09-15')
  })

  it('values outside 0..100 are 422 "Markah mesti antara 0 dan 100."', async () => {
    const err = await w.service.saveTov(wctx('t1', 'teacher'), manual, { rows: [{ userId: 'p1', tov: -1 }, { userId: 'p2', etr: 100.5 }] }).catch((e: unknown) => e)
    expect((err as ApiError).getStatus()).toBe(422)
    expect((err as ApiError).fields).toEqual({ 'rows.0.tov': MSG.markRange, 'rows.1.etr': MSG.markRange })
  })
})

describe('Tetapan and CF-05', () => {
  it('lowering below a checkpoint with marks is 409 without confirm, and nothing changes', async () => {
    w.repo.addEntry(manual, 'p1', { actuals: new Map([[3, 70]]) })
    const err = await w.service.saveSettings(wctx('t1', 'teacher'), manual, { activeOtrs: 2 }).catch((e: unknown) => e)
    expect((err as ApiError).getStatus()).toBe(409)
    expect((err as ApiError).message).toBe('OTR3 ke atas mempunyai markah. Padam markah tersebut?')
    expect(w.repo.configs.find((c) => c.id === manual)?.activeOtrs).toBe(3)
    expect(w.repo.entry(manual, 'p1')?.actuals.get(3)).toBe(70)
  })

  it('with confirm the marks above n are deleted and the count saved in one go, with an audit row', async () => {
    w.repo.addEntry(manual, 'p1', { actuals: new Map([[1, 60], [3, 70]]) })
    const d = await w.service.saveSettings(wctx('t1', 'teacher'), manual, { activeOtrs: 2, confirm: true })
    expect(d.config.activeOtrs).toBe(2)
    expect(w.repo.entry(manual, 'p1')?.actuals.has(3)).toBe(false)
    expect(w.repo.entry(manual, 'p1')?.actuals.get(1)).toBe(60)
    expect(w.audit.record).toHaveBeenCalledTimes(1)
    expect(w.audit.record.mock.calls[0]?.[0]).toMatchObject({ action: 'headcount.config.otrs_changed', details: { from: 3, to: 2, marksDeleted: 1 } })
  })

  it('an Auto config is trimmed without the CF-05 prompt', async () => {
    const d = await w.service.saveSettings(wctx('t1', 'teacher'), auto, { activeOtrs: 2 })
    expect(d.config.activeOtrs).toBe(2)
  })

  it('the marks-above check and the delete both run inside the transaction', async () => {
    w.repo.addEntry(manual, 'p1', { actuals: new Map([[3, 70]]) })
    let inTx = false
    const seen: string[] = []
    const prisma = (w.service as unknown as { prisma: { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> } }).prisma
    const run = prisma.transaction.bind(prisma)
    prisma.transaction = async (fn) => {
      inTx = true
      try {
        return await run(fn)
      } finally {
        inTx = false
      }
    }
    const repo = w.repo as unknown as Record<string, (...a: unknown[]) => unknown>
    for (const name of ['firstCheckpointAbove', 'setActiveOtrs']) {
      const orig = repo[name]!.bind(w.repo)
      repo[name] = (...a) => {
        seen.push(`${name}:${String(inTx)}`)
        return orig(...a)
      }
    }
    expect(await status(w.service.saveSettings(wctx('t1', 'teacher'), manual, { activeOtrs: 2 }))).toBe(409)
    await w.service.saveSettings(wctx('t1', 'teacher'), manual, { activeOtrs: 2, confirm: true })
    expect(seen).toEqual(['firstCheckpointAbove:true', 'setActiveOtrs:true'])
  })

  it('lowering with no marks above, and raising, need no confirm; 2..5 only', async () => {
    expect((await w.service.saveSettings(wctx('t1', 'teacher'), manual, { activeOtrs: 2 })).config.activeOtrs).toBe(2)
    expect((await w.service.saveSettings(wctx('t1', 'teacher'), manual, { activeOtrs: 5 })).config.activeOtrs).toBe(5)
    expect(await status(w.service.saveSettings(wctx('t1', 'teacher'), manual, { activeOtrs: 6 }))).toBe(422)
    expect(await status(w.service.saveSettings(wctx('t1', 'teacher'), manual, { activeOtrs: 1 }))).toBe(422)
  })
})

describe('Simpan Sasaran (defaults)', () => {
  it('sets and clears the class defaults, 0..100 only', async () => {
    const d = await w.service.saveDefaults(wctx('t1', 'teacher'), manual, { defaultTov: 40, defaultEtr: 80 })
    expect(d.config).toMatchObject({ defaultTov: 40, defaultEtr: 80 })
    expect(lineOf(d, 'p1')).toMatchObject({ tov: 40, etr: 80 })
    const cleared = await w.service.saveDefaults(wctx('t1', 'teacher'), manual, { defaultTov: null, defaultEtr: null })
    expect(cleared.config).toMatchObject({ defaultTov: null, defaultEtr: null })
    expect(await status(w.service.saveDefaults(wctx('t1', 'teacher'), manual, { defaultTov: 101, defaultEtr: null }))).toBe(422)
    expect(await status(w.service.saveDefaults(wctx('t1', 'teacher'), manual, { defaultTov: 5 }))).toBe(422)
  })
})

describe('the pupil\'s own view', () => {
  it('lists the configs of the own class for the current year by membership, with no entry row needed', async () => {
    w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual', academicYear: 2025, subjectId: '5' })
    const list = await w.service.listOwn(ctx('p1', 'student'))
    expect(list.map((c) => c.id).sort()).toEqual([manual, auto].sort())
    expect(list.every((c) => c.entryStatus === 'draft' && c.statusReason === 'belum_ada_data')).toBe(true)
    expect(await w.service.listOwn(ctx('p9', 'student'))).toHaveLength(1)
  })

  it('a pupil dropped from the config does not see it', async () => {
    w.repo.addEntry(manual, 'p1', { dropped: true })
    expect((await w.service.listOwn(ctx('p1', 'student'))).map((c) => c.id)).toEqual([auto])
    expect(await status(w.service.detailOwn(ctx('p1', 'student'), manual))).toBe(404)
  })

  it('detail is the own line only; a foreign or unknown config is 404; omitted picks the last updated', async () => {
    w.repo.addEntry(manual, 'p1', { tov: 40, etr: 80, actuals: new Map([[1, 60]]) })
    w.repo.addEntry(manual, 'p2', { tov: 10, etr: 20 })
    const d = await w.service.detailOwn(ctx('p1', 'student'), manual)
    expect(d.student.id).toBe('p1')
    expect(d.sections).toHaveLength(1)
    expect(d.sections[0]).toMatchObject({ configId: manual, tov: 40, etr: 80, mode: 'manual', status: 'on' })
    expect(JSON.stringify(d)).not.toContain('p2')
    expect(await status(w.service.detailOwn(ctx('p1', 'student'), foreign))).toBe(404)
    expect(await status(w.service.detailOwn(ctx('p1', 'student'), '99999'))).toBe(404)
    w.repo.configs.find((c) => c.id === auto)!.updatedAt = new Date('2026-10-01T00:00:00+08:00')
    expect((await w.service.detailOwn(ctx('p1', 'student'), undefined)).sections[0]?.configId).toBe(auto)
  })

  it('Manual shows only the own keyed AR; Auto the own live AR', async () => {
    w.repo.addEntry(manual, 'p1', { actuals: new Map([[1, 61.5]]) })
    w.repo.addEntry(manual, 'p2', { actuals: new Map([[1, 99]]) })
    w.answers.addMany('p1', 2, 1, { mode: 'practice', answeredAt: new Date('2026-05-01T10:00:00+08:00'), subjectId: '2' })
    const m = await w.service.detailOwn(ctx('p1', 'student'), manual)
    expect(m.sections[0]?.rows[0]?.ar).toBe(61.5)
    const a = await w.service.detailOwn(ctx('p1', 'student'), auto)
    expect(a.sections[0]?.rows.map((r) => r.ar)).toEqual([50, 50, 50])
  })
})
