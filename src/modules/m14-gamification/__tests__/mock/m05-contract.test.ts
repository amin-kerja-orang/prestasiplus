/**
 * M14 ← M05 practice contract (review MAJOR-2; `mock/repository/reads.ts`). **F-26 must make this
 * pass against the real `practice` repository.** It is skipped while `@/modules/m05-practice/mock`
 * is the F-01 stub (no `practice` export); once M05 exports `practice`, every case runs and a broken
 * contract fails here (the M14 reads then throw `RepositoryError('CONTRACT')`).
 *
 * Contract:
 * - `practice.history(userId, {date?: 'YYYY-MM-DD', modes?: string[]})` → every completed session
 *   matching the filter, unpaged, as an array of rows with `id`, `mode`, `status`, `correct`,
 *   `total`, `completedAt`, `timeSpent` (DATA-M05-01);
 * - `practice.answers(userId, {date})` → an array of `{chapterId, subjectId, isCorrect, answeredAt}`;
 * - `practice.mastery(userId)` → an array of `{subjectId, correct, answered}`.
 *
 * It also pins the seeds M14's designed replay depends on (SRS M14 v1.7 §6.11.3; M05 §6.12): the
 * sessions P1–P4 and M1–M4 with their exact values, the M3 / M4 chapters, and that M05 does not
 * credit them again (the designed wallets stay 370 / 916 and 267 / 432).
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock, toEpochMs } from '@/lib/time'
import { bootMock } from '@/mock/index'

import { wallet } from '../../mock'
import { DESIGNED_SESSIONS, MATH_D1_CHAPTERS } from '../../mock/data/designed'
import { hasPracticeRepository, m05PracticeReads } from '../../mock/repository/reads'
import { localDate } from '../../mock/repository/rules'

const PRACTICE_MODES = ['random', 'chapter', 'revision']

describe.skipIf(!hasPracticeRepository())('M14 ← M05 practice contract (F-26)', () => {
  beforeAll(async () => {
    await bootMock({
      mode: 'test',
      clock: createClock({ at: CLOCK_ANCHOR_ISO }),
      latencyMs: 0,
      onWarn: null,
    })
  }, 120_000)

  const reads = () => m05PracticeReads()

  it('history(userId, {date}) returns the designed sessions P1–P4 and M1–M4 exactly', () => {
    for (const d of DESIGNED_SESSIONS) {
      const day = reads().sessionsOn(d.userId, localDate(d.completedAt))
      const s = day.find((x) => x.id === d.sessionId)
      expect(s, `${d.sessionId} on ${localDate(d.completedAt)}`).toBeDefined()
      expect(s).toMatchObject({
        mode: d.mode,
        correct: d.correct,
        total: d.total,
        timeSpent: d.timeSpent,
      })
      expect(toEpochMs(s?.completedAt ?? '')).toBe(toEpochMs(d.completedAt))
    }
  })

  it('history(userId, {modes}) returns every completed practice-mode session, unpaged', () => {
    const ids = reads()
      .practiceSessions(4)
      .map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['M1', 'M2', 'M3', 'M4']))
    expect(
      reads()
        .practiceSessions(4)
        .every((s) => PRACTICE_MODES.includes(s.mode)),
    ).toBe(true)
    // pelajar's designed sessions are SPM modes only.
    expect(
      reads()
        .practiceSessions(2)
        .map((s) => s.id),
    ).not.toEqual(expect.arrayContaining(['P1']))
  })

  it('answers(userId, {date}) carries the M3 / M4 chapters (the "Penjelajah Topik" metric)', () => {
    const chapters = new Set(
      reads()
        .answersOn(4, '2026-09-25')
        .map((a) => a.chapterId),
    )
    for (const id of Object.values(MATH_D1_CHAPTERS)) expect(chapters.has(id)).toBe(true)
  })

  it('mastery(userId) returns the per-subject counters (pelajarmaju MATH 26 / 37)', () => {
    expect(reads().mastery(4)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectId: 3, correct: 26, answered: 37 }),
      ]),
    )
  })

  it('M05 does not credit the designed sessions again (wallets stay as designed)', () => {
    expect(wallet.summary(2)).toMatchObject({ currentSyiling: 370, xp: 916 })
    expect(wallet.summary(4)).toMatchObject({ currentSyiling: 267, xp: 432 })
  })
})

describe('M14 ← M05 practice contract status', () => {
  it('reports whether the contract ran', () => {
    if (!hasPracticeRepository()) {
      console.info('[M14 ← M05 contract] skipped: M05 exports no `practice` repository yet (F-26)')
    }
    expect(true).toBe(true)
  })
})
