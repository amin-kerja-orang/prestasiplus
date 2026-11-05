import { PerformanceStudentSchema } from '@pp/contract'
import { vi, beforeEach, describe, expect, it } from 'vitest'

import { FixedClock } from '../../../../src/db/clock'
import { HeadcountFactsService } from '../../../../src/modules/reports/performance/headcount/headcount-facts.service'
import { HeadcountService } from '../../../../src/modules/reports/performance/headcount/headcount.service'
import { PerformancePorts } from '../../../../src/modules/reports/performance/ports'
import { StudentPerformanceService } from '../../../../src/modules/reports/performance/services/student-performance.service'
import type { Ctx } from '../../../../src/modules/reports/performance/services/types'
import { InMemoryAnswerFacts } from '../fakes/in-memory-answer-facts'
import { InMemoryClasses } from '../fakes/in-memory-classes'
import { InMemoryDirectory } from '../fakes/in-memory-directory'
import { InMemoryHeadcountRepo } from '../fakes/in-memory-headcount-repo'

/**
 * S10-T01 part 2 (FR-MUR-4-6): the Prestasi 360 "Headcount - Prestasi SPM" block reads the shared headcount facts, so
 * its figures are those of `GET /headcounts/me/detail` (API-RPT-08): one computation, no second one.
 */
const NOW = '2026-11-05T10:00:00+08:00'

const ctx = (userId: string, role: Ctx['role'], schoolId = 's1'): Ctx => ({
  userId,
  role,
  scope: role === 'admin' ? { level: 'national', label: 'x' } : { level: 'school', schoolId, label: 'x' },
  isTest: false,
})

function world() {
  const repo = new InMemoryHeadcountRepo()
  const directory = new InMemoryDirectory()
  directory.addPupil({ id: 't1', name: 'Cikgu Contoh', schoolId: 's1', isStudent: false })
  for (const id of ['p1', 'p2']) directory.addPupil({ id, name: `Murid ${id}`, schoolId: 's1' })
  directory.addSchool({ id: 's1' })
  const classes = new InMemoryClasses().add({ id: 'c1', schoolId: 's1', teacherId: 't1' }, ['p1', 'p2'])
  const answers = new InMemoryAnswerFacts()
  const ports = new PerformancePorts(undefined, classes, undefined, undefined, undefined, answers)
  const clock = new FixedClock(NOW)
  const audit = { record: vi.fn(async () => undefined) }
  const prisma = { transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}) }
  const me = new HeadcountService(repo.asRepo(), ports, directory, prisma as never, audit as never, clock)
  const facts = new HeadcountFactsService(repo.asRepo(), ports)
  const student = new StudentPerformanceService(ports, directory, clock, facts)
  return { repo, answers, me, student }
}

let w: ReturnType<typeof world>
beforeEach(() => {
  w = world()
})

describe('Prestasi 360 Headcount block (FR-MUR-4-6)', () => {
  it('equals the pupil\'s own `me` figures: TOV, ETR, the OTR chips (AR against the computed target) and the status', async () => {
    const manual = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual', activeOtrs: 3 }).id
    // TOV 40, ETR 80, n = 3 gives the targets 53 / 66 / 80; AR 60 then 70 is On Track at the latest checkpoint (HC-SPEC).
    w.repo.addEntry(manual, 'p1', { tov: 40, etr: 80, actuals: new Map([[1, 60], [2, 70]]) })
    w.repo.addEntry(manual, 'p2', { tov: 10, etr: 20, actuals: new Map([[1, 99]]) })
    const r = await w.student.student(ctx('p1', 'student'), 'p1')
    PerformanceStudentSchema.parse(r)
    const own = await w.me.detailOwn(ctx('p1', 'student'), undefined)
    expect(r.headcount).toHaveLength(own.sections.length)
    const card = r.headcount[0]
    const section = own.sections[0]
    expect(card).toMatchObject({ configId: section?.configId, tov: section?.tov, etr: section?.etr, status: section?.status, year: section?.year })
    expect(card?.chips).toEqual([
      { label: 'TOV', value: 40, tone: 'none' },
      { label: 'OTR1', value: 60, tone: 'on' },
      { label: 'OTR2', value: 70, tone: 'on' },
      { label: 'ETR', value: 80, tone: 'none' },
    ])
    // The chips are the `me` rows: the same AR per checkpoint, 'on' exactly when the row is not below its target.
    const rows = (section?.rows ?? []).filter((x) => x.ar !== null)
    expect((card?.chips ?? []).filter((c) => c.label.startsWith('OTR')).map((c) => c.value)).toEqual(rows.map((x) => x.ar))
    expect(card?.status).toBe('on')
    // No classmate figure anywhere in the pupil's own payload.
    expect(JSON.stringify(r.headcount)).not.toContain('99')
  })

  it('a pupil below the latest target reads Below; no AR (or no ETR) reads "none" with its own tone-free chips', async () => {
    const manual = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual' }).id
    const second = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual', subjectId: '2' }).id
    w.repo.addEntry(manual, 'p1', { tov: 40, etr: 80, actuals: new Map([[1, 50]]) })
    w.repo.addEntry(second, 'p1', { tov: 40, etr: 80 })
    const r = await w.student.student(ctx('p1', 'student'), 'p1')
    const byConfig = new Map(r.headcount.map((c) => [c.configId, c]))
    expect(byConfig.get(manual)?.status).toBe('below')
    expect(byConfig.get(manual)?.chips.find((c) => c.label === 'OTR1')).toMatchObject({ value: 50, tone: 'below' })
    expect(byConfig.get(second)?.status).toBe('none')
    expect(byConfig.get(second)?.chips.map((c) => c.label)).toEqual(['TOV', 'ETR'])
    const own = await w.me.detailOwn(ctx('p1', 'student'), second)
    expect(own.sections[0]?.status).toBe('none')
  })

  it('the Auto AR is the one live AR of the `me` view (same answer store, same rounding)', async () => {
    const auto = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'auto', subjectId: '2' }).id
    w.repo.configs.find((c) => c.id === auto)!.defaultTov = 40
    w.repo.configs.find((c) => c.id === auto)!.defaultEtr = 80
    w.answers.addMany('p1', 3, 2, { mode: 'practice', answeredAt: new Date('2026-05-01T10:00:00+08:00'), subjectId: '2' })
    const r = await w.student.student(ctx('p1', 'student'), 'p1')
    const own = await w.me.detailOwn(ctx('p1', 'student'), auto)
    const ar = own.sections[0]?.rows.find((x) => x.ar !== null)?.ar
    expect(ar).toBe(67)
    expect(r.headcount[0]?.chips.find((c) => c.label.startsWith('OTR'))?.value).toBe(ar)
    expect(r.headcount[0]?.status).toBe(own.sections[0]?.status)
  })

  it('a config of the pupil\'s own class needs no entry row: the class defaults show, as in `me`', async () => {
    const manual = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual' }).id
    w.repo.configs.find((c) => c.id === manual)!.defaultTov = 40
    w.repo.configs.find((c) => c.id === manual)!.defaultEtr = 80
    const r = await w.student.student(ctx('p1', 'student'), 'p1')
    const own = await w.me.detailOwn(ctx('p1', 'student'), manual)
    expect(r.headcount.map((c) => c.configId)).toEqual([manual])
    expect(r.headcount[0]).toMatchObject({ tov: 40, etr: 80, status: own.sections[0]?.status })
    expect(r.headcount[0]?.status).toBe('none')
  })

  it('shows the current year only (like `me`); an older config is not on the block', async () => {
    const current = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual' }).id
    const old = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual', academicYear: 2025, subjectId: '3' }).id
    w.repo.addEntry(current, 'p1', { tov: 40, etr: 80 })
    w.repo.addEntry(old, 'p1', { tov: 30, etr: 70 })
    const r = await w.student.student(ctx('p1', 'student'), 'p1')
    expect(r.headcount.map((c) => c.configId)).toEqual([current])
    expect(r.headcount[0]?.year).toBe(2026)
    expect((await w.me.listOwn(ctx('p1', 'student'))).map((c) => c.id)).toEqual([current])
  })

  it('a dropped pupil sees nothing, and so does a pupil with no headcount (empty array, no error)', async () => {
    const manual = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual' }).id
    w.repo.addEntry(manual, 'p1', { tov: 40, etr: 80, dropped: true })
    w.repo.addEntry(manual, 'p2', { tov: 40, etr: 80 })
    expect((await w.student.student(ctx('p1', 'student'), 'p1')).headcount).toEqual([])
    expect(await w.me.listOwn(ctx('p1', 'student'))).toEqual([])
    const none = world()
    expect((await none.student.student(ctx('p1', 'student'), 'p1')).headcount).toEqual([])
  })

  it('privacy: the pupil never gets a classmate\'s block (404) and the own block holds only own entries', async () => {
    const manual = w.repo.addConfig({ teacherId: 't1', classroomId: 'c1', mode: 'manual' }).id
    w.repo.addEntry(manual, 'p1', { tov: 40, etr: 80 })
    w.repo.addEntry(manual, 'p2', { tov: 11, etr: 22 })
    await expect(w.student.student(ctx('p1', 'student'), 'p2')).rejects.toMatchObject({ status: 404 })
    const r = await w.student.student(ctx('p1', 'student'), 'p1')
    expect(r.headcount).toHaveLength(1)
    expect(r.headcount[0]).toMatchObject({ tov: 40, etr: 80 })
  })
})
