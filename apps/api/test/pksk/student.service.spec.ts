import { PkskDashboardSchema, PkskExamSchema, PkskPracticeSchema, PkskDomainSectionsSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { STUDENT, buildWorld, grant, seedQuestions, type World } from './fakes'

async function code(p: Promise<unknown>): Promise<{ status: number; code: string; fields?: Record<string, string>; message: string }> {
  try {
    await p
  } catch (e) {
    const err = e as ApiError
    return { status: err.getStatus(), code: err.code, ...(err.fields ? { fields: err.fields } : {}), message: err.message }
  }
  throw new Error('expected an error')
}

const keysDeep = (v: unknown, out: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out))
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.add(k)
      keysDeep(x, out)
    }
  }
  return out
}

describe('level gate (AC 1, 2)', () => {
  it('404 for an unknown level before any access check, 403 without access', async () => {
    const { student } = buildWorld()
    for (const bad of ['T9', 't1', 'ALL', '']) {
      expect(await code(student.dashboard(STUDENT, bad))).toMatchObject({ status: 404, message: 'Not Found.' })
    }
    expect(await code(student.dashboard(STUDENT, 'T1'))).toMatchObject({ status: 403, message: 'This action is unauthorized.' })
  })

  it('a T1-only grant opens every T1 route and closes every T4 route', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    seedQuestions(world, 'PKSK_MATH', 'T4', 2)
    await student.dashboard(STUDENT, 'T1')
    await student.sections(STUDENT, 'T1')
    await student.practiceSet(STUDENT, 'T1', 'PKSK_MATH')
    await student.attempts(STUDENT, 'T1')
    await student.exam(STUDENT, 'T1')
    const calls: Promise<unknown>[] = [
      student.dashboard(STUDENT, 'T4'),
      student.sections(STUDENT, 'T4'),
      student.practiceSet(STUDENT, 'T4', 'PKSK_MATH'),
      student.attempts(STUDENT, 'T4'),
      student.exam(STUDENT, 'T4'),
      student.submitPractice(STUDENT, 'T4', 'PKSK_MATH', { answers: [{ questionId: '1000' }] }),
      student.submitExam(STUDENT, 'T4', { answers: [{ questionId: '1000' }] }),
    ]
    for (const c of calls) expect(await code(c)).toMatchObject({ status: 403 })
  })

  it('access flags: expiry through the end of the day, revoked and expired grant nothing, Kombo both, admin both, subscription both', async () => {
    const { student, world } = buildWorld()
    expect(await student.access(STUDENT)).toEqual({ T1: false, T4: false })
    grant(world, '10', 'T1', { expiresAt: '2026-10-20' }) // expired
    grant(world, '10', 'T4', { status: 'revoked' })
    expect(await student.access(STUDENT)).toEqual({ T1: false, T4: false })
    grant(world, '10', 'T1', { expiresAt: '2026-10-21' }) // today still valid
    expect(await student.access(STUDENT)).toEqual({ T1: true, T4: false })
    grant(world, '11', 'ALL')
    expect(await student.access({ ...STUDENT, userId: '11' })).toEqual({ T1: true, T4: true })
    expect(await student.access({ userId: '5', role: 'admin', isTest: false } as never)).toEqual({ T1: true, T4: true })
    world.subscribed.add('7')
    expect(await student.access({ userId: '7', role: 'student', isTest: false } as never)).toEqual({ T1: true, T4: true })
  })
})

describe('reads', () => {
  it('dashboard: rounded mean, grade of the unrounded mean, Bahagian B domains with mastery, other users never count', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    const at = (n: number) => new Date(Date.UTC(2026, 8, n))
    world.attempts.push(
      { id: '1', userId: '10', level: 'T1', completedAt: at(1), scorePct: 64.4, bahagianA: 0, bahagianB: 52.4, bahagianC: 0, grade: 'C', isTest: false },
      { id: '2', userId: '10', level: 'T1', completedAt: at(2), scorePct: 64.5, bahagianA: 0, bahagianB: 67, bahagianC: 0, grade: 'C', isTest: false },
      { id: '3', userId: '11', level: 'T1', completedAt: at(3), scorePct: 100, bahagianA: 0, bahagianB: 100, bahagianC: 0, grade: 'A', isTest: false },
      { id: '4', userId: '10', level: 'T1', completedAt: at(4), scorePct: 100, bahagianA: 0, bahagianB: 100, bahagianC: 0, grade: 'A', isTest: true },
    )
    world.mastery.push({ userId: '10', level: 'T1', domainId: '2', pct: 70, isTest: false })
    const d = PkskDashboardSchema.parse(await student.dashboard(STUDENT, 'T1'))
    expect(d.readiness).toEqual({ scorePct: 64, grade: 'C' })
    expect(d.examCount).toBe(2)
    expect(d.bahagianBAvgPct).toBe(59.7)
    expect(d.domains).toHaveLength(13)
    expect(d.domains[0]).toMatchObject({ code: 'PKSK_MATH', masteryPct: 70 })
    // test mode sees its own test attempt
    expect((await student.dashboard({ ...STUDENT, isTest: true }, 'T1')).examCount).toBe(3)
  })

  it('dashboard with no attempt is 0 / E', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T4')
    expect((await student.dashboard(STUDENT, 'T4')).readiness).toEqual({ scorePct: 0, grade: 'E' })
  })

  it('sections A, B, C with the mock copy and approved counts per level only', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    seedQuestions(world, 'PKSK_MATH', 'T1', 3)
    seedQuestions(world, 'PKSK_MATH', 'T1', 2, 'pending')
    seedQuestions(world, 'PKSK_MATH', 'T4', 4)
    const s = PkskDomainSectionsSchema.parse(await student.sections(STUDENT, 'T1'))
    expect(s.map((x) => [x.bahagian, x.name, x.subtitle])).toEqual([
      ['A', 'Kecerdasan Insaniah', 'Nilai, akhlak & sahsiah'],
      ['B', 'Kecerdasan Intelek', 'Kognitif & penaakulan'],
      ['C', 'Artikulasi Penulisan', 'Penulisan kreatif'],
    ])
    expect(s[1]?.domains[0]).toMatchObject({ code: 'PKSK_MATH', questionCount: 3 })
  })

  it('practice set: 404 for an unknown domain (level first), at most 10, never a correctness flag, records the load', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    seedQuestions(world, 'PKSK_MATH', 'T1', 14)
    expect(await code(student.practiceSet(STUDENT, 'T1', 'NOPE'))).toMatchObject({ status: 404 })
    expect(await code(student.practiceSet(STUDENT, 'T9', 'NOPE'))).toMatchObject({ status: 404 })
    const p = PkskPracticeSchema.parse(await student.practiceSet(STUDENT, 'T1', 'PKSK_MATH'))
    expect(p.questions).toHaveLength(10)
    const keys = keysDeep(p)
    for (const forbidden of ['isCorrect', 'correct', 'answer', 'explanation', 'correctIndexes']) expect(keys.has(forbidden)).toBe(false)
    expect(world.loads).toHaveLength(1)
  })

  it('essay questions are served with no options', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    seedQuestions(world, 'PKSK_ESSAY', 'T1', 1)
    const p = await student.practiceSet(STUDENT, 'T1', 'PKSK_ESSAY')
    expect(p.questions[0]?.options).toEqual([])
  })
})

describe('practice submit (AC 7)', () => {
  const setup = () => {
    const w = buildWorld()
    grant(w.world, '10', 'T1')
    return { ...w, qs: seedQuestions(w.world, 'PKSK_MATH', 'T1', 4) } // option 0 correct for even i, 1 for odd i
  }
  const nothingWritten = (world: World) => {
    expect(world.sessions).toHaveLength(0)
    expect(world.mastery).toHaveLength(0)
  }

  it('422 "Jawapan tidak sah." for empty, duplicate, mistyped, unknown, other-domain, other-level and unapproved answers, writing nothing', async () => {
    const { student, world, qs } = setup()
    const other = seedQuestions(world, 'PKSK_SCI', 'T1', 1)[0]
    const t4 = seedQuestions(world, 'PKSK_MATH', 'T4', 1)[0]
    const pending = seedQuestions(world, 'PKSK_MATH', 'T1', 1, 'pending')[0]
    const bodies: unknown[] = [
      { answers: [] },
      {},
      null,
      { answers: [{ questionId: qs[0]?.id, optionIndex: 0 }, { questionId: qs[0]?.id, optionIndex: 1 }] },
      { answers: [{ questionId: 5, optionIndex: 0 }] },
      { answers: [{ questionId: qs[0]?.id, optionIndex: 'a' }] },
      { answers: [{ questionId: qs[0]?.id, extra: 1 }] },
      { answers: [{ questionId: '424242', optionIndex: 0 }] },
      { answers: [{ questionId: other?.id, optionIndex: 0 }] },
      { answers: [{ questionId: t4?.id, optionIndex: 0 }] },
      { answers: [{ questionId: pending?.id, optionIndex: 0 }] },
    ]
    for (const b of bodies) {
      expect(await code(student.submitPractice(STUDENT, 'T1', 'PKSK_MATH', b)), JSON.stringify(b)).toMatchObject({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Jawapan tidak sah.',
        fields: { answers: 'Jawapan tidak sah.' },
      })
    }
    nothingWritten(world)
  })

  it('scores server side, upserts mastery, consumes the load, returns the M05 session and gamification', async () => {
    const { student, world, qs } = setup()
    await student.practiceSet(STUDENT, 'T1', 'PKSK_MATH')
    const res = await student.submitPractice(STUDENT, 'T1', 'PKSK_MATH', {
      answers: [
        { questionId: qs[0]?.id, optionIndex: 0 }, // correct
        { questionId: qs[1]?.id, optionIndex: 0 }, // wrong
        { questionId: qs[2]?.id, optionIndex: 0 }, // correct
      ],
    })
    expect(res.masteryPct).toBe(67)
    expect(res.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.gamification).toEqual({ coinsEarned: 5, pointsEarned: 10, streakCount: 1, totalBalance: 105 })
    expect(world.mastery).toEqual([{ userId: '10', level: 'T1', domainId: '2', pct: 67, isTest: false }])
    expect(world.loads).toHaveLength(0)
    expect(world.sessions).toHaveLength(1)
    expect(world.sessions[0]?.startedAt.getTime()).toBeLessThanOrEqual(world.sessions[0]?.completedAt.getTime() as number)
    // one row per user, level and domain: a second submission updates it
    await student.submitPractice(STUDENT, 'T1', 'PKSK_MATH', { answers: [{ questionId: qs[0]?.id, optionIndex: 0 }] })
    expect(world.mastery).toHaveLength(1)
    expect(world.mastery[0]?.pct).toBe(100)
  })

  it('a start time after now is clamped to now', async () => {
    const { student, world, qs } = setup()
    world.loads.push({ userId: '10', level: 'T1', domainId: '2', at: new Date(world.clock.now().getTime() + 3600_000) })
    await student.submitPractice(STUDENT, 'T1', 'PKSK_MATH', { answers: [{ questionId: qs[0]?.id, optionIndex: 0 }] })
    expect(world.sessions[0]?.startedAt.getTime()).toBe(world.clock.now().getTime())
  })

  it('Mod Pelajar stamps the session and mastery as test', async () => {
    const { student, world, qs } = setup()
    await student.submitPractice({ ...STUDENT, isTest: true }, 'T1', 'PKSK_MATH', { answers: [{ questionId: qs[0]?.id, optionIndex: 0 }] })
    expect(world.sessions[0]?.isTest).toBe(true)
    expect(world.mastery[0]?.isTest).toBe(true)
  })

  it('a failure after the session is recorded rolls back the mastery row and the load', async () => {
    const { student, world, qs } = setup()
    await student.practiceSet(STUDENT, 'T1', 'PKSK_MATH')
    world.failPractice = true
    await expect(student.submitPractice(STUDENT, 'T1', 'PKSK_MATH', { answers: [{ questionId: qs[0]?.id, optionIndex: 0 }] })).rejects.toThrow('forced failure')
    expect(world.mastery).toHaveLength(0)
    expect(world.loads).toHaveLength(1)
  })

  it('essay: 50 trimmed characters are accepted by the simulated marker', async () => {
    const { student, world } = setup()
    const essay = seedQuestions(world, 'PKSK_ESSAY', 'T1', 1)[0]
    const bad = await student.submitPractice(STUDENT, 'T1', 'PKSK_ESSAY', { answers: [{ questionId: essay?.id, text: 'x'.repeat(49) }] })
    expect(bad.masteryPct).toBe(0)
    const good = await student.submitPractice(STUDENT, 'T1', 'PKSK_ESSAY', { answers: [{ questionId: essay?.id, text: ` ${'x'.repeat(50)} ` }] })
    expect(good.masteryPct).toBe(100)
  })
})

describe('exam (AC 8, 9)', () => {
  it('serves A, B, C with weights 20 / 70 / 10, fewer when short, approved of the level only, no correctness', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    seedQuestions(world, 'PKSK_INSANIAH', 'T1', 35)
    seedQuestions(world, 'PKSK_MATH', 'T1', 40)
    seedQuestions(world, 'PKSK_SCI', 'T1', 40)
    seedQuestions(world, 'PKSK_ESSAY', 'T1', 3)
    seedQuestions(world, 'PKSK_MATH', 'T4', 10)
    seedQuestions(world, 'PKSK_MATH', 'T1', 10, 'rejected')
    const exam = PkskExamSchema.parse(await student.exam(STUDENT, 'T1'))
    expect(exam.sections.map((s) => [s.bahagian, s.weightPct, s.questions.length])).toEqual([['A', 20, 30], ['B', 70, 70], ['C', 10, 1]])
    expect(keysDeep(exam).has('isCorrect')).toBe(false)
    const short = await student.exam(STUDENT, 'T1')
    expect(short.sections[0]?.questions).toHaveLength(30)
  })

  it('scores on the planned counts, stores one attempt, grade of the score, no other write', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    const a = seedQuestions(world, 'PKSK_INSANIAH', 'T1', 30)
    const b = seedQuestions(world, 'PKSK_MATH', 'T1', 70)
    const answers = [
      ...a.slice(0, 30).map((q, i) => ({ questionId: q.id, optionIndex: i % 2 === 0 ? 0 : 1 })), // all correct
      ...b.slice(0, 35).map((q, i) => ({ questionId: q.id, optionIndex: i % 2 === 0 ? 0 : 1 })), // 35 of 70 correct
    ]
    const res = await student.submitExam(STUDENT, 'T1', { answers })
    // A 100, B 50, C 0 -> 0.2*100 + 0.7*50 + 0 = 55
    expect(res).toMatchObject({ scorePct: 55, grade: 'C' })
    expect(res.completedAt).toMatch(/\+08:00$/)
    expect(world.attempts).toHaveLength(1)
    expect(world.attempts[0]).toMatchObject({ bahagianA: 100, bahagianB: 50, bahagianC: 0 })
    expect(world.sessions).toHaveLength(0)
    expect(world.mastery).toHaveLength(0)
  })

  it('422 for too many answers in a part, an unapproved or other-level question; nothing is written', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    const essays = seedQuestions(world, 'PKSK_ESSAY', 'T1', 2)
    const t4 = seedQuestions(world, 'PKSK_MATH', 'T4', 1)[0]
    const pending = seedQuestions(world, 'PKSK_MATH', 'T1', 1, 'pending')[0]
    for (const answers of [
      essays.map((q) => ({ questionId: q.id, text: 'x'.repeat(60) })),
      [{ questionId: t4?.id, optionIndex: 0 }],
      [{ questionId: pending?.id, optionIndex: 0 }],
      [],
    ]) {
      expect(await code(student.submitExam(STUDENT, 'T1', { answers }))).toMatchObject({ status: 422, fields: { answers: 'Jawapan tidak sah.' } })
    }
    expect(world.attempts).toHaveLength(0)
  })

  it('attempts list is the caller own, newest first', async () => {
    const { student, world } = buildWorld()
    grant(world, '10', 'T1')
    const q = seedQuestions(world, 'PKSK_ESSAY', 'T1', 1)[0]
    await student.submitExam(STUDENT, 'T1', { answers: [{ questionId: q?.id, text: 'x'.repeat(60) }] })
    world.attempts.push({ id: '9', userId: '11', level: 'T1', completedAt: new Date(), scorePct: 90, bahagianA: 0, bahagianB: 0, bahagianC: 0, grade: 'A', isTest: false })
    const list = await student.attempts(STUDENT, 'T1')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ scorePct: 10, grade: 'E' })
  })
})
