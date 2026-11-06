import { describe, expect, it } from 'vitest'

import type { AnswerFactRow, AnswerFactsPort, WeeklyFactRow } from '../../../../src/modules/reports/performance/ports'

/** What a seed gives the factory. Ids are the seed's own ('1', 'c1'); a real-DB factory maps them. */
export interface AnswerFactsSeed {
  pupils: { id: string; schoolId: string; classroomIds: string[] }[]
  chapters: { id: string; name: string; dskpCode: string | null; subjectId: string; levelCode: string | null }[]
  topics: { id: string; chapterId: string; name: string }[]
  answers: {
    userId: string
    subjectId: string
    questionId: string
    chapterId?: string
    topicId?: string
    mode: string
    isCorrect: boolean
    answeredAt: Date
    sessionId?: string
    isTest?: boolean
    levelCode?: string
  }[]
  /**
   * The finished-session rows `sessionDurations` reads. The answers above only carry session ids (a key, not a finished
   * session), so a real-DB factory must store those as unfinished placeholders: only these rows are ever counted.
   */
  sessions?: {
    userId: string
    subjectId: string
    mode: string
    status: 'in_progress' | 'completed'
    timeSpentSec: number
    completedAt: Date
    isTest?: boolean
  }[]
}

export interface AnswerFactsContractOptions {
  /** False until S5-T15 adds `practice_answers.mode`: an answer outside a session has no mode before it. */
  sessionlessMode: boolean
}

const at = (iso: string): Date => new Date(iso)

// 2026-09-21 and 2026-09-28 are Mondays.
const SEED: AnswerFactsSeed = {
  pupils: [
    { id: '1', schoolId: 's1', classroomIds: ['c1'] },
    { id: '2', schoolId: 's2', classroomIds: ['c2'] },
  ],
  chapters: [
    { id: '50', name: 'Bab Lima', dskpCode: '5.1', subjectId: '1', levelCode: 't4' },
    { id: '51', name: 'Bab Tanpa Tahap', dskpCode: null, subjectId: '2', levelCode: null },
  ],
  topics: [{ id: '100', chapterId: '50', name: 'Topik Seratus' }],
  answers: [
    { userId: '1', subjectId: '1', questionId: '10', chapterId: '50', topicId: '100', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-22T10:00:00+08:00'), sessionId: 'sA' },
    { userId: '1', subjectId: '1', questionId: '10', chapterId: '50', topicId: '100', mode: 'latih_tubi', isCorrect: false, answeredAt: at('2026-09-22T10:01:00+08:00'), sessionId: 'sA' },
    { userId: '1', subjectId: '1', questionId: '11', chapterId: '50', topicId: '100', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-23T09:00:00+08:00'), sessionId: 'sA' },
    // Sunday 23:30 MYT: still the week of 2026-09-21.
    { userId: '1', subjectId: '1', questionId: '12', chapterId: '50', mode: 'simulasi', isCorrect: false, answeredAt: at('2026-09-27T23:30:00+08:00'), sessionId: 'sB' },
    // Monday 00:30 MYT: the next week.
    { userId: '1', subjectId: '2', questionId: '20', mode: 'simulasi', isCorrect: true, answeredAt: at('2026-09-28T00:30:00+08:00'), sessionId: 'sC' },
    { userId: '1', subjectId: '1', questionId: '14', mode: 'battle', isCorrect: false, answeredAt: at('2026-09-23T12:00:00+08:00'), sessionId: 'sD' },
    // Mod Pelajar: never returned.
    { userId: '1', subjectId: '1', questionId: '10', chapterId: '50', topicId: '100', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-22T10:02:00+08:00'), sessionId: 'sA', isTest: true },
    { userId: '2', subjectId: '1', questionId: '10', chapterId: '50', topicId: '100', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-22T11:00:00+08:00'), sessionId: 'sE', levelCode: 't5' },
  ],
  sessions: [
    { userId: '1', subjectId: '1', mode: 'latih_tubi', status: 'completed', timeSpentSec: 600, completedAt: at('2026-09-22T10:10:00+08:00') },
    { userId: '1', subjectId: '2', mode: 'simulasi', status: 'completed', timeSpentSec: 90, completedAt: at('2026-09-28T00:10:00+08:00') },
    { userId: '1', subjectId: '1', mode: 'battle', status: 'completed', timeSpentSec: 1000, completedAt: at('2026-09-23T12:10:00+08:00') },
    // Not finished: never counted.
    { userId: '1', subjectId: '1', mode: 'latih_tubi', status: 'in_progress', timeSpentSec: 500, completedAt: at('2026-09-24T10:00:00+08:00') },
    // Mod Pelajar: never returned.
    { userId: '1', subjectId: '1', mode: 'latih_tubi', status: 'completed', timeSpentSec: 700, completedAt: at('2026-09-22T10:20:00+08:00'), isTest: true },
    { userId: '2', subjectId: '1', mode: 'latih_tubi', status: 'completed', timeSpentSec: 300, completedAt: at('2026-09-22T11:10:00+08:00') },
  ],
}

// Rows stored out of time order: the first answer is the earliest by answered_at, not the first stored.
const FIRST: AnswerFactsSeed = {
  pupils: [{ id: '1', schoolId: 's1', classroomIds: [] }],
  chapters: [],
  topics: [],
  answers: [
    { userId: '1', subjectId: '1', questionId: '30', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-22T09:00:00+08:00'), sessionId: 'sF' },
    { userId: '1', subjectId: '1', questionId: '30', mode: 'latih_tubi', isCorrect: false, answeredAt: at('2026-09-22T08:00:00+08:00'), sessionId: 'sF' },
    { userId: '1', subjectId: '1', questionId: '30', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-22T10:00:00+08:00'), sessionId: 'sF' },
    { userId: '1', subjectId: '1', questionId: '31', mode: 'latih_tubi', isCorrect: false, answeredAt: at('2026-09-22T11:00:00+08:00'), sessionId: 'sF' },
    { userId: '1', subjectId: '1', questionId: '31', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-22T07:00:00+08:00'), sessionId: 'sF' },
  ],
}

const SESSIONLESS: AnswerFactsSeed = {
  pupils: [{ id: '1', schoolId: 's1', classroomIds: [] }],
  chapters: [],
  topics: [],
  answers: [
    // Same mode, same MYT day: one session. A second mode that day: another. Next day: another.
    { userId: '1', subjectId: '1', questionId: '1', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-22T08:00:00+08:00') },
    { userId: '1', subjectId: '1', questionId: '2', mode: 'latih_tubi', isCorrect: false, answeredAt: at('2026-09-22T09:00:00+08:00') },
    { userId: '1', subjectId: '1', questionId: '3', mode: 'chapter', isCorrect: true, answeredAt: at('2026-09-22T09:30:00+08:00') },
    { userId: '1', subjectId: '1', questionId: '4', mode: 'latih_tubi', isCorrect: true, answeredAt: at('2026-09-23T09:30:00+08:00') },
  ],
}

const key = (r: AnswerFactRow): string => [r.userId, r.subjectId, r.questionId, r.chapterId ?? '-', r.topicId ?? '-', r.mode].join('|')
const sorted = (rows: AnswerFactRow[]): AnswerFactRow[] => [...rows].sort((a, b) => (key(a) < key(b) ? -1 : 1))
const totals = (rows: AnswerFactRow[]): [number, number] => [rows.reduce((n, r) => n + r.attempts, 0), rows.reduce((n, r) => n + r.correct, 0)]
const weeks = (rows: WeeklyFactRow[]): [string, string, number, number, number][] => rows.map((r) => [r.userId, r.weekStart, r.attempts, r.correct, r.sessions])

/** The contract every `AnswerFactsPort` must meet: the in-memory fake and the SQL adapter run the same cases. */
export function describeAnswerFactsPort(
  name: string,
  make: (seed: AnswerFactsSeed) => Promise<AnswerFactsPort>,
  opts: AnswerFactsContractOptions = { sessionlessMode: true },
): void {
  describe(`AnswerFactsPort: ${name}`, () => {
    it('answerFacts: one row per user, subject, question, chapter, topic and mode; test rows never returned', async () => {
      const port = await make(SEED)
      const rows = sorted(await port.answerFacts({ userIds: ['1'] }))
      expect(rows).toHaveLength(5)
      const q10 = rows.find((r) => r.questionId === '10')
      expect(q10).toMatchObject({ attempts: 2, correct: 1, mode: 'latih_tubi', topicId: '100', chapterId: '50' })
      expect(q10?.lastAnsweredAt.getTime()).toBe(at('2026-09-22T10:01:00+08:00').getTime())
      // S10-T03: the first answer of the row (right at 10:00; the later wrong one and the test row do not change it).
      expect(q10).toMatchObject({ firstCorrect: true })
      expect(q10?.firstAnsweredAt.getTime()).toBe(at('2026-09-22T10:00:00+08:00').getTime())
      expect(rows.find((r) => r.questionId === '12')).toMatchObject({ firstCorrect: false })
      expect(rows.find((r) => r.questionId === '20')).toMatchObject({ firstCorrect: true })
      expect(rows.find((r) => r.questionId === '12')).toMatchObject({ attempts: 1, correct: 0, topicId: null, chapterId: '50', mode: 'simulasi' })
      expect(rows.find((r) => r.questionId === '20')).toMatchObject({ attempts: 1, correct: 1, topicId: null, chapterId: null })
      expect(totals(rows)).toEqual([6, 3])
    })

    it("answerFacts: grain 'user-subject' keeps the totals and last answer, one row per user and subject", async () => {
      const port = await make(SEED)
      const rows = await port.answerFacts({ userIds: ['1'], grain: 'user-subject' })
      expect(rows.map((r) => [r.subjectId, r.attempts, r.correct]).sort()).toEqual([['1', 5, 2], ['2', 1, 1]])
      expect(rows.every((r) => r.questionId === '0' && r.chapterId === null && r.topicId === null)).toBe(true)
      expect(totals(rows)).toEqual(totals(await port.answerFacts({ userIds: ['1'] })))
      const s1 = rows.find((r) => r.subjectId === '1')
      expect(s1?.lastAnsweredAt.getTime()).toBe(at('2026-09-27T23:30:00+08:00').getTime())
    })

    it('answerFacts: firstCorrect is the first answer by answered_at whatever the insertion order', async () => {
      const port = await make(FIRST)
      const rows = await port.answerFacts({ userIds: ['1'] })
      expect(rows).toHaveLength(2)
      const wrongFirst = rows.find((r) => r.questionId === '30')
      const rightFirst = rows.find((r) => r.questionId === '31')
      expect(wrongFirst).toMatchObject({ attempts: 3, correct: 2, firstCorrect: false })
      expect(wrongFirst?.firstAnsweredAt.getTime()).toBe(at('2026-09-22T08:00:00+08:00').getTime())
      expect(rightFirst).toMatchObject({ attempts: 2, correct: 1, firstCorrect: true })
    })

    it('answerFacts: filters by pupil, mode, window, subject, school, class and level; empty lists match nothing', async () => {
      const port = await make(SEED)
      expect(totals(await port.answerFacts({}))).toEqual([7, 4])
      expect(await port.answerFacts({ userIds: [] })).toEqual([])
      expect(await port.answerFacts({ modes: [] })).toEqual([])
      expect(totals(await port.answerFacts({ userIds: ['1'], modes: ['simulasi'] }))).toEqual([2, 1])
      expect(totals(await port.answerFacts({ userIds: ['1'], modes: ['latih_tubi', 'battle'] }))).toEqual([4, 2])
      expect(totals(await port.answerFacts({ userIds: ['1'], from: at('2026-09-27T00:00:00+08:00') }))).toEqual([2, 1])
      expect(totals(await port.answerFacts({ userIds: ['1'], to: at('2026-09-23T00:00:00+08:00') }))).toEqual([2, 1])
      expect(totals(await port.answerFacts({ userIds: ['1'], subjectId: '2' }))).toEqual([1, 1])
      expect(totals(await port.answerFacts({ schoolIds: ['s2'] }))).toEqual([1, 1])
      expect(totals(await port.answerFacts({ classroomId: 'c1' }))).toEqual([6, 3])
      expect(totals(await port.answerFacts({ levelCode: 't5' }))).toEqual([1, 1])
    })

    it('weeklyFacts: Monday weeks in Malaysian time, distinct sessions, test rows left out', async () => {
      const port = await make(SEED)
      expect(weeks(await port.weeklyFacts({ userIds: ['1'] }))).toEqual([
        ['1', '2026-09-21', 5, 2, 3],
        ['1', '2026-09-28', 1, 1, 1],
      ])
      // A battle row is one session of its own unless the modes filter leaves it out.
      expect(weeks(await port.weeklyFacts({ userIds: ['1'], modes: ['latih_tubi', 'simulasi'] }))).toEqual([
        ['1', '2026-09-21', 4, 2, 2],
        ['1', '2026-09-28', 1, 1, 1],
      ])
      expect(weeks(await port.weeklyFacts({ userIds: ['1'], from: at('2026-09-28T00:00:00+08:00') }))).toEqual([['1', '2026-09-28', 1, 1, 1]])
      expect(await port.weeklyFacts({ userIds: [] })).toEqual([])
    })

    it.skipIf(!opts.sessionlessMode)('weeklyFacts: answers with no session count one session per mode per Malaysian day', async () => {
      const port = await make(SESSIONLESS)
      expect(weeks(await port.weeklyFacts({ userIds: ['1'] }))).toEqual([['1', '2026-09-21', 4, 3, 3]])
    })

    it('dailyFacts: one row per pupil and Malaysian day, the day boundary is MYT midnight, test rows left out', async () => {
      const port = await make(SEED)
      const days = (rows: { userId: string; day: string; attempts: number; correct: number; sessions: number }[]): [string, string, number, number, number][] =>
        rows.map((r) => [r.userId, r.day, r.attempts, r.correct, r.sessions])
      expect(days(await port.dailyFacts({ userIds: ['1'] }))).toEqual([
        ['1', '2026-09-22', 2, 1, 1],
        ['1', '2026-09-23', 2, 1, 2],
        ['1', '2026-09-27', 1, 0, 1],
        ['1', '2026-09-28', 1, 1, 1],
      ])
      expect(days(await port.dailyFacts({ userIds: ['1'], modes: ['latih_tubi', 'simulasi'] }))).toEqual([
        ['1', '2026-09-22', 2, 1, 1],
        ['1', '2026-09-23', 1, 1, 1],
        ['1', '2026-09-27', 1, 0, 1],
        ['1', '2026-09-28', 1, 1, 1],
      ])
      expect(days(await port.dailyFacts({ userIds: ['1'], from: at('2026-09-28T00:00:00+08:00') }))).toEqual([['1', '2026-09-28', 1, 1, 1]])
      expect(await port.dailyFacts({ userIds: [] })).toEqual([])
      expect(await port.dailyFacts({ modes: [] })).toEqual([])
    })

    it.skipIf(!opts.sessionlessMode)('dailyFacts: answers with no session count one session per mode', async () => {
      const port = await make(SESSIONLESS)
      const rows = await port.dailyFacts({ userIds: ['1'] })
      expect(rows.map((r) => [r.day, r.attempts, r.correct, r.sessions])).toEqual([
        ['2026-09-22', 3, 2, 2],
        ['2026-09-23', 1, 1, 1],
      ])
    })

    it('sessionDurations: finished, non-test sessions only; seconds and count per pupil; filters by mode, subject and window', async () => {
      // Only seed.sessions count. User 1 has 5 rows: completed 600 (latih_tubi, subj 1, 09-22), 90 (simulasi, subj 2, 09-28),
      // 1000 (battle, subj 1, 09-23) = 3 sessions / 1690 s; the in_progress and the is_test rows are left out.
      // User 2 has one completed 300 s. Session ids sA..sE on the answers are not durations, so they add nothing.
      const port = await make(SEED)
      const of = async (q: Parameters<AnswerFactsPort['sessionDurations']>[0]): Promise<[string, number, number][]> =>
        (await port.sessionDurations(q)).map((r) => [r.userId, r.sessions, r.seconds])
      expect(await of({ userIds: ['1'] })).toEqual([['1', 3, 1690]])
      expect(await of({})).toEqual([['1', 3, 1690], ['2', 1, 300]])
      expect(await of({ userIds: ['1'], modes: ['latih_tubi', 'simulasi'] })).toEqual([['1', 2, 690]])
      expect(await of({ userIds: ['1'], subjectId: '2' })).toEqual([['1', 1, 90]])
      expect(await of({ userIds: ['1'], from: at('2026-09-23T00:00:00+08:00') })).toEqual([['1', 2, 1090]])
      expect(await of({ userIds: ['1'], to: at('2026-09-23T00:00:00+08:00') })).toEqual([['1', 1, 600]])
      expect(await of({ userIds: [] })).toEqual([])
      expect(await of({ modes: [] })).toEqual([])
    })

    it('sessionCounts: distinct sessions over the whole window (a session across Monday is one), per subject and in total', async () => {
      const port = await make(SEED)
      const rows = await port.sessionCounts({ userIds: ['1'] })
      const of = (subjectId: string | null): number | undefined => rows.find((r) => r.userId === '1' && r.subjectId === subjectId)?.sessions
      // sA, sB, sC, sD in total; subject 1 has sA, sB, sD and subject 2 has sC.
      expect(of(null)).toBe(4)
      expect(of('1')).toBe(3)
      expect(of('2')).toBe(1)
      const noBattle = await port.sessionCounts({ userIds: ['1'], modes: ['latih_tubi', 'simulasi'] })
      expect(noBattle.find((r) => r.subjectId === null)?.sessions).toBe(3)
      expect(await port.sessionCounts({ userIds: [] })).toEqual([])
    })

    it('sessionFacts: one row per session, newest first, subject and totals of the session, test rows and unlisted modes left out', async () => {
      const port = await make(SEED)
      const rows = await port.sessionFacts({ userIds: ['1'], modes: ['latih_tubi', 'simulasi'], limit: 10 })
      // sA (3 real answers, 2 right; the Mod Pelajar row is not read), sB (Sunday 23:30 MYT), sC (Monday 00:30 MYT); sD is a game mode.
      expect(rows.map((r) => [r.sessionKey, r.subjectId, r.mode, r.answered, r.correct, r.finishedAt.toISOString()])).toEqual([
        ['s:sC', '2', 'simulasi', 1, 1, at('2026-09-28T00:30:00+08:00').toISOString()],
        ['s:sB', '1', 'simulasi', 1, 0, at('2026-09-27T23:30:00+08:00').toISOString()],
        ['s:sA', '1', 'latih_tubi', 3, 2, at('2026-09-23T09:00:00+08:00').toISOString()],
      ])
      expect(rows.every((r) => r.userId === '1')).toBe(true)
      expect((await port.sessionFacts({ userIds: ['1'], modes: ['latih_tubi', 'simulasi'], limit: 2 })).map((r) => r.sessionKey)).toEqual(['s:sC', 's:sB'])
      expect((await port.sessionFacts({ userIds: ['1'], modes: ['latih_tubi', 'simulasi'], to: at('2026-09-28T00:00:00+08:00'), limit: 10 })).map((r) => r.sessionKey)).toEqual(['s:sB', 's:sA'])
      // Another pupil's rows are never returned for this pupil.
      expect((await port.sessionFacts({ userIds: ['2'], modes: ['latih_tubi'], limit: 10 })).map((r) => r.sessionKey)).toEqual(['s:sE'])
      expect(await port.sessionFacts({ userIds: ['1'], modes: [], limit: 10 })).toEqual([])
      expect(await port.sessionFacts({ userIds: [], modes: ['latih_tubi'], limit: 10 })).toEqual([])
    })

    it('spInfo: topic name with the chapter code, chapter name without a code, subject and level', async () => {
      const port = await make(SEED)
      const info = await port.spInfo({ topicIds: ['100'], chapterIds: ['50', '51'] })
      const topic = info.find((i) => i.kind === 'topic')
      const ch50 = info.find((i) => i.kind === 'chapter' && i.id === '50')
      const ch51 = info.find((i) => i.kind === 'chapter' && i.id === '51')
      expect(topic).toMatchObject({ id: '100', label: 'Topik Seratus', code: '5.1' })
      expect(ch50).toMatchObject({ id: '50', label: 'Bab Lima', code: null })
      expect(ch51).toMatchObject({ id: '51', label: 'Bab Tanpa Tahap', code: null, levelId: null })
      expect(ch50?.levelId).not.toBeNull()
      expect(topic?.levelId).toBe(ch50?.levelId)
      expect(topic?.subjectCode).toBe(ch50?.subjectCode)
      expect(await port.spInfo({ topicIds: [], chapterIds: [] })).toEqual([])
    })
  })
}
