import { GURU_SET_MESSAGES } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { FixedClock } from '../../src/db/clock'
import type { ClassActor } from '../../src/modules/classes/actor'
import {
  GURU_SET_MAX_ATTEMPTS,
  GuruQuestionSetsService,
  accuracyOf,
  difficultyOf,
  previewOf,
  roundHalfUp,
} from '../../src/modules/classes/teacher-sets/guru-question-sets.service'

/** DB-free: the rules of the teacher Set Soalan service (S6-T14) with fake collaborators. */

describe('pure rules', () => {
  it('preview: 120 characters plus "..." only when cut', () => {
    expect(previewOf('a'.repeat(120))).toBe('a'.repeat(120))
    expect(previewOf('a'.repeat(121))).toBe(`${'a'.repeat(120)}...`)
    expect(previewOf('  dua   baris\nteks ')).toBe('dua baris teks')
  })
  it('score: whole number rounded half up; accuracy one decimal', () => {
    expect([roundHalfUp(70), roundHalfUp(66.5), roundHalfUp(66.49), roundHalfUp(0.5)]).toEqual([70, 67, 66, 1])
    expect([accuracyOf(4, 5), accuracyOf(1, 3), accuracyOf(2, 3), accuracyOf(0, 0), accuracyOf(7, 8)]).toEqual([80, 33.3, 66.7, 0, 87.5])
  })
  it('difficulty 1..5: the typed level, else TP clamped, else 3', () => {
    expect(difficultyOf({ difficultyLevel: 2, difficultyTp: 6 })).toBe(2)
    expect(difficultyOf({ difficultyLevel: null, difficultyTp: 6 })).toBe(5)
    expect(difficultyOf({ difficultyLevel: null, difficultyTp: null })).toBe(3)
  })
  it('a teacher set has no attempt cap (0 = unlimited, guardSubmit enforces only > 0)', () => {
    expect(GURU_SET_MAX_ATTEMPTS).toBe(0)
  })
})

interface Calls {
  created: unknown[]
  updated: unknown[]
  items: unknown[]
  classes: unknown[]
  statuses: unknown[]
  audits: string[]
}

function build(opts: { sessions?: boolean; stored?: string[]; classes?: string[]; eligible?: string[]; groups?: { id: string; questionIds: string[] }[]; grouped?: Record<string, string> } = {}) {
  const calls: Calls = { created: [], updated: [], items: [], classes: [], statuses: [], audits: [] }
  const rec = (over: object = {}) => ({
    id: '50',
    teacherId: '10',
    classroomId: null,
    subjectId: '7',
    educationLevelId: null,
    title: 'Set',
    timeLimitMinutes: null,
    maxAttempts: 0,
    status: 'draft',
    scheduledAt: null,
    needsRebuild: false,
    isTest: false,
    kind: 'set',
    createdAt: new Date('2026-10-19T01:00:00Z'),
    updatedAt: new Date('2026-10-19T01:00:00Z'),
    ...over,
  })
  const repo = {
    getOwn: (_t: string, id: string) => Promise.resolve(id === '50' ? rec() : null),
    storedItems: () => Promise.resolve((opts.stored ?? ['1', '2']).map((questionId) => ({ questionId, versionNo: 1 }))),
    hasSessions: () => Promise.resolve(opts.sessions ?? false),
    classroomIdsOf: () => Promise.resolve(new Map([['50', opts.classes ?? []]])),
    create: (i: unknown) => (calls.created.push(i), Promise.resolve(rec({ id: '51', status: (i as { status: string }).status }))),
    update: (_id: string, p: unknown) => (calls.updated.push(p), Promise.resolve(rec({ status: (p as { status: string }).status }))),
    replaceItems: (_id: string, items: unknown) => (calls.items.push(items), Promise.resolve()),
    replaceClassrooms: (_id: string, ids: unknown) => (calls.classes.push(ids), Promise.resolve()),
    setStatus: (_id: string, s: string) => (calls.statuses.push(s), Promise.resolve(rec({ status: s }))),
  }
  const eligibleSet = new Set(opts.eligible ?? ['1', '2', '3'])
  const questions = {
    eligibleAmong: (ids: string[]) => Promise.resolve(ids.filter((i) => eligibleSet.has(i))),
    getMany: (ids: string[]) => Promise.resolve(ids.map((id) => ({ id, groupId: opts.grouped?.[id] ?? null, version: { versionNo: 3 } }))),
    groupsByIds: (ids: string[]) => Promise.resolve((opts.groups ?? []).filter((g) => ids.includes(g.id))),
  }
  const classes = {
    activeSubjectExists: (id: string) => Promise.resolve(id === '7'),
    byIds: (ids: string[]) => Promise.resolve(ids.filter((i) => i === '5').map((id) => ({ id, kind: 'classroom', teacherId: '10', isActive: true }))),
  }
  const audit = { record: (e: { action: string }) => (calls.audits.push(e.action), Promise.resolve()) }
  const prisma = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn({}) }
  const service = new GuruQuestionSetsService(
    repo as never,
    {} as never,
    questions as never,
    classes as never,
    {} as never,
    {} as never,
    audit as never,
    prisma as never,
    new FixedClock(new Date('2026-10-19T01:00:00Z')),
  )
  const actor = { auth: { sessionRowId: null, active: { scope: { level: 'school' } } }, userId: '10', role: 'teacher', schoolId: '3', isTest: false, requestId: null, ip: null } as unknown as ClassActor
  return { service, actor, calls }
}

const form = (over: Record<string, unknown> = {}) => ({ title: ' Ujian ', subjectId: '7', questionIds: ['1', '2'], classroomIds: ['5'], status: 'draft', ...over })

describe('create', () => {
  it('saves a draft with the live version numbers, 0 attempts cap, an audit row', async () => {
    const { service, actor, calls } = build()
    await service.create(actor, form())
    expect(calls.created[0]).toMatchObject({ title: 'Ujian', subjectId: '7', status: 'draft', maxAttempts: 0, teacherId: '10' })
    expect(calls.items[0]).toEqual([{ questionId: '1', versionNo: 3 }, { questionId: '2', versionNo: 3 }])
    expect(calls.classes[0]).toEqual(['5'])
    expect(calls.audits).toEqual(['classes.question_set.created'])
  })
  it('publish needs a class (422 fields.classroomIds); draft does not', async () => {
    const { service, actor, calls } = build()
    await expect(service.create(actor, form({ status: 'published', classroomIds: [] }))).rejects.toMatchObject({ fields: { classroomIds: GURU_SET_MESSAGES.classRequiredToPublish } })
    await service.create(actor, form({ classroomIds: [] }))
    expect(calls.created).toHaveLength(1)
  })
  it('a class that is not own is refused; a non-eligible question is refused', async () => {
    const { service, actor } = build()
    await expect(service.create(actor, form({ classroomIds: ['6'] }))).rejects.toMatchObject({ fields: { classroomIds: GURU_SET_MESSAGES.invalid } })
    await expect(service.create(actor, form({ questionIds: ['1', '9'] }))).rejects.toMatchObject({ fields: { questionIds: GURU_SET_MESSAGES.invalid } })
    await expect(service.create(actor, form({ questionIds: ['1', '1'] }))).rejects.toMatchObject({ fields: { questionIds: GURU_SET_MESSAGES.invalid } })
  })
  it('FR-GUR-8b-8: part of a stimulus group is 422 groupSplit; the whole group passes; an archived member is not required', async () => {
    const groups = [{ id: '90', questionIds: ['1', '2', '3'] }]
    const grouped = { '1': '90', '2': '90', '3': '90' }
    const split = build({ groups, grouped })
    await expect(split.service.create(split.actor, form({ questionIds: ['1', '2'] }))).rejects.toMatchObject({ fields: { questionIds: GURU_SET_MESSAGES.groupSplit } })
    const whole = build({ groups, grouped })
    await whole.service.create(whole.actor, form({ questionIds: ['1', '2', '3'] }))
    expect(whole.calls.created).toHaveLength(1)
    const archived = build({ groups, grouped, eligible: ['1', '2'] })
    await archived.service.create(archived.actor, form({ questionIds: ['1', '2'] }))
    expect(archived.calls.created).toHaveLength(1)
  })
  it('cap of 100 questions and the required fields come from the contract (all failing fields together)', async () => {
    const { service, actor } = build()
    await expect(service.create(actor, form({ questionIds: Array.from({ length: 101 }, (_, i) => String(i + 1)) }))).rejects.toMatchObject({ fields: { questionIds: GURU_SET_MESSAGES.questionsTooMany } })
    await expect(service.create(actor, { status: 'draft' })).rejects.toMatchObject({
      fields: { title: GURU_SET_MESSAGES.titleRequired, subjectId: GURU_SET_MESSAGES.subjectRequired, questionIds: GURU_SET_MESSAGES.questionsRequired },
    })
  })
})

describe('update lock (AC-GUR-8b-12)', () => {
  it('without sessions a changed list replaces the items', async () => {
    const { service, actor, calls } = build()
    await service.update(actor, '50', form({ questionIds: ['2', '3'] }))
    expect(calls.items[0]).toEqual([{ questionId: '2', versionNo: 3 }, { questionId: '3', versionNo: 3 }])
  })
  it('with sessions a changed list is 409 locked AFTER the title, classes and status were saved; the items are untouched', async () => {
    const { service, actor, calls } = build({ sessions: true })
    await expect(service.update(actor, '50', form({ title: 'Baharu', questionIds: ['3'], status: 'published' }))).rejects.toMatchObject({ status: 409, message: GURU_SET_MESSAGES.locked })
    expect(calls.updated[0]).toMatchObject({ title: 'Baharu', status: 'published' })
    expect(calls.classes).toHaveLength(1)
    expect(calls.items).toHaveLength(0)
  })
  it('with sessions the same list saves (an archived stored question does not block a title edit)', async () => {
    const { service, actor, calls } = build({ sessions: true, eligible: ['2'] })
    await service.update(actor, '50', form({ title: 'Sama', questionIds: ['1', '2'] }))
    expect(calls.updated).toHaveLength(1)
    expect(calls.items).toHaveLength(0)
  })
  it('another teacher or an unknown id is 404 before anything is read from the body', async () => {
    const { service, actor } = build()
    await expect(service.update(actor, '99', form())).rejects.toMatchObject({ status: 404 })
    await expect(service.update(actor, 'abc', form())).rejects.toMatchObject({ status: 404 })
  })
})

describe('status and copy', () => {
  it('Terbitkan without a stored class is 422; with one it publishes; Jadikan Draf needs none', async () => {
    const none = build({ classes: [] })
    await expect(none.service.setStatus(none.actor, '50', { status: 'published' })).rejects.toMatchObject({ fields: { classroomIds: GURU_SET_MESSAGES.classRequiredToPublish } })
    const one = build({ classes: ['5'] })
    await one.service.setStatus(one.actor, '50', { status: 'published' })
    await one.service.setStatus(one.actor, '50', { status: 'draft' })
    expect(one.calls.statuses).toEqual(['published', 'draft'])
    await expect(one.service.setStatus(one.actor, '50', { status: 'scheduled' })).rejects.toMatchObject({ fields: { status: GURU_SET_MESSAGES.statusInvalid } })
  })
  it('copy: a draft titled "{title} (Salinan)", the stored items, the chosen own class only', async () => {
    const { service, actor, calls } = build({ stored: ['1', '2', '3'] })
    await service.copy(actor, '50', { classroomIds: ['5'] })
    expect(calls.created[0]).toMatchObject({ title: 'Set (Salinan)', status: 'draft' })
    expect((calls.items[0] as unknown[]).length).toBe(3)
    expect(calls.classes[0]).toEqual(['5'])
    await expect(service.copy(actor, '50', { classroomIds: ['6'] })).rejects.toMatchObject({ fields: { classroomIds: GURU_SET_MESSAGES.classRequiredToCopy } })
    await expect(service.copy(actor, '50', { classroomIds: [] })).rejects.toMatchObject({ fields: { classroomIds: GURU_SET_MESSAGES.classRequiredToCopy } })
  })
})

describe('bank query', () => {
  it('q shorter than 2 characters is 422 fields.q', async () => {
    const { service } = build()
    await expect(service.bank({ q: 'a' })).rejects.toMatchObject({ status: 422, fields: { q: GURU_SET_MESSAGES.searchTooShort } })
  })
})
