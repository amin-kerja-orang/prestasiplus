import { describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import { REVIEW_TOPIC } from '../domain/topic'
import { BijakError, BijakServer, GRACE_SECONDS, MemoryStorage } from '../server/store'

const USER = 7
const MIN = 60_000

function make(now = { t: 1_800_000_000_000 }, storage = new MemoryStorage()) {
  const server = new BijakServer({ storage, now: () => now.t })
  return { server, now, storage }
}

const correctChoice = (qid: string): string => {
  const s = BANK.schemes.get(qid)!
  if (s.kind !== 'option') throw new Error('mcq')
  return s.correct
}

describe('flagged tags and students (DSKP-T03 review F1)', () => {
  it('a question that still needs a tag has an empty topic and no "Perlu semakan tag" weak-topic bucket', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    const view = await server.getAttemptView(USER, attemptId)
    const flagged = view.questions.filter((q) => BANK.questions.get(q.id)!.curriculum.review)
    expect(flagged.length).toBeGreaterThan(0)
    for (const q of flagged) expect(q.topic).toBe('')
    expect(view.questions.some((q) => q.topic === REVIEW_TOPIC)).toBe(false)

    // submit with nothing answered: every counted mark is lost, as the result page's weak topics sum
    await server.submit(USER, attemptId, { changes: [], idempotencyKey: 'k-f1' })
    const res = await server.getResult(USER, attemptId)
    const topicOfQ = new Map(res.paper.questions.map((q) => [q.id, q.topic]))
    const lost = new Map<string, number>()
    for (const q of res.result.questions) {
      const topic = topicOfQ.get(q.questionId)
      if (q.counted && topic) lost.set(topic, (lost.get(topic) ?? 0) + (q.marks - q.awarded))
    }
    expect(lost.has(REVIEW_TOPIC)).toBe(false)
    expect([...topicOfQ.values()].includes(REVIEW_TOPIC)).toBe(false)
  })
})

describe('scheme reveal rules (US-15)', () => {
  it('serves a paper without keys and refuses the result before submit', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    const view = await server.getAttemptView(USER, attemptId)
    const json = JSON.stringify(view)
    for (const word of ['"correct"', 'reason', 'accept', '"scheme"', 'tolerance'])
      expect(json).not.toContain(word)
    await expect(server.getResult(USER, attemptId)).rejects.toMatchObject({ code: 'not_submitted' })
    await expect(
      server.checkQuestion(USER, attemptId, view.questions[0]!.id),
    ).rejects.toBeInstanceOf(BijakError)
  })
  it('reveals the scheme per question in Latihan only after Semak', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'latihan')
    const view = await server.getAttemptView(USER, attemptId)
    expect(view.checks).toHaveLength(0)
    const q = view.questions[0]!.id
    const res = await server.checkQuestion(USER, attemptId, q, {
      changes: [{ partId: q, answer: { choice: correctChoice(q) }, rev: 1, savedAt: 1 }],
    })
    expect(res.awarded).toBe(1)
    expect(res.parts[0]!.scheme.correctOption).toBe(correctChoice(q))
    const again = await server.getAttemptView(USER, attemptId)
    expect(again.checks.map((c) => c.questionId)).toEqual([q])
  })
  it('keeps one student from reading another student attempt', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    await expect(server.getAttemptView(99, attemptId)).rejects.toMatchObject({ code: 'forbidden' })
  })
})

describe('submit grades the union of saved and carried answers (AC-13.2, fixes N-01)', () => {
  it('counts an answer that was typed but never autosaved', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    const view = await server.getAttemptView(USER, attemptId)
    const [q1, q2] = view.questions
    // q1 reached the server by autosave; q2 only travels with the submit request
    await server.saveAnswers(USER, attemptId, {
      changes: [{ partId: q1!.id, answer: { choice: correctChoice(q1!.id) }, rev: 1, savedAt: 1 }],
    })
    await server.submit(USER, attemptId, {
      idempotencyKey: 'k1',
      changes: [],
      answers: { [q2!.id]: { answer: { choice: correctChoice(q2!.id) }, rev: 1, savedAt: 2 } },
    })
    const r = await server.getResult(USER, attemptId)
    expect(r.result.score).toBe(2)
    expect(r.result.max).toBe(10)
  })
  it('is idempotent: a repeat records one submission and the same result', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    const payload = { idempotencyKey: 'same', changes: [] }
    await server.submit(USER, attemptId, payload)
    const a = await server.getResult(USER, attemptId)
    await server.submit(USER, attemptId, {
      ...payload,
      answers: { x: { answer: { choice: 'y' }, rev: 9, savedAt: 9 } },
    })
    const b = await server.getResult(USER, attemptId)
    expect(b.result).toEqual(a.result)
    expect((await server.history(USER)).filter((h) => h.status === 'submitted')).toHaveLength(1)
  })
  it('never lets an older revision overwrite a newer saved one', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    const q = (await server.getAttemptView(USER, attemptId)).questions[0]!.id
    await server.saveAnswers(USER, attemptId, {
      changes: [{ partId: q, answer: { choice: 'B' }, rev: 3, savedAt: 3 }],
    })
    await server.saveAnswers(USER, attemptId, {
      changes: [{ partId: q, answer: { choice: 'A' }, rev: 2, savedAt: 2 }],
    })
    expect(server.debugSaved(attemptId)[q]!.answer.choice).toBe('B')
  })
  it('ignores parts that are not in the served composition', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    await server.saveAnswers(USER, attemptId, {
      changes: [{ partId: 'sn2-osmosis-a', answer: { text: 'x' }, rev: 1, savedAt: 1 }],
    })
    expect(Object.keys(server.debugSaved(attemptId))).toHaveLength(0)
  })
})

describe('timer (US-05)', () => {
  it('stores a server deadline and accepts a late submit with late_by_seconds', async () => {
    const { server, now } = make()
    const { attemptId } = await server.startAttempt(USER, 'sn-k2-2025-a', 'exam')
    const v = await server.getAttemptView(USER, attemptId)
    expect(v.attempt.deadline).toBe(v.attempt.startedAt + 60 * MIN)
    now.t += 60 * MIN + 90_000
    const out = await server.submit(USER, attemptId, { idempotencyKey: 'late', changes: [] })
    expect(out.late).toBe(90)
    expect((await server.getResult(USER, attemptId)).attempt.status).toBe('submitted')
  })
  it('closes an unattended attempt from the last saved answers after the grace period', async () => {
    const { server, now } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    const q = (await server.getAttemptView(USER, attemptId)).questions[0]!.id
    await server.saveAnswers(USER, attemptId, {
      changes: [{ partId: q, answer: { choice: correctChoice(q) }, rev: 1, savedAt: 1 }],
    })
    now.t += 75 * MIN + (GRACE_SECONDS - 1) * 1000
    expect((await server.history(USER))[0]!.status).toBe('in_progress')
    now.t += 2000
    const row = (await server.history(USER))[0]!
    expect(row.status).toBe('auto_submitted')
    expect(row.score).toBe(1)
  })
  it('has no deadline in Latihan', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'latihan')
    expect((await server.getAttemptView(USER, attemptId)).attempt.deadline).toBeNull()
  })
})

describe('resume (US-12) and persistence', () => {
  it('offers resume, restart abandons the old sitting, and a refresh keeps everything', async () => {
    const { server, now, storage } = make()
    const first = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    expect((await server.findInProgress(USER, 'mat-k1-2025-a'))!.fresh).toBe(true)
    now.t += 5 * MIN
    const info = (await server.findInProgress(USER, 'mat-k1-2025-a'))!
    expect(info).toMatchObject({ attemptId: first.attemptId, fresh: false, elapsedSeconds: 300 })
    // same paper without restart returns the same sitting
    expect((await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')).attemptId).toBe(
      first.attemptId,
    )
    // refresh
    const reloaded = new BijakServer({ storage, now: () => now.t })
    expect((await reloaded.findInProgress(USER, 'mat-k1-2025-a'))!.attemptId).toBe(first.attemptId)
    const second = await reloaded.startAttempt(USER, 'mat-k1-2025-a', 'exam', { restart: true })
    expect(second.attemptId).not.toBe(first.attemptId)
    const rows = await reloaded.history(USER)
    expect(rows.find((r) => r.attemptId === first.attemptId)!.status).toBe('abandoned')
  })
})

describe('Jana Kertas on the server', () => {
  it('creates a paper for the student and records the exact questions served', async () => {
    const { server } = make()
    const out = await server.generatePaper(USER, 'MAT', 1)
    if (!out.ok) throw new Error('expected a paper')
    const cover = await server.getCover(USER, out.paperId)
    expect(cover.kind).toBe('jana')
    expect(cover.questionCount).toBe(10)
    expect(cover.marks).toBe(10)
    const { attemptId } = await server.startAttempt(USER, out.paperId, 'exam')
    const before = (await server.getAttemptView(USER, attemptId)).questions.map((q) => q.id)
    expect(before).toHaveLength(10)
    // another student cannot open this generated paper
    await expect(server.getCover(99, out.paperId)).rejects.toMatchObject({ code: 'not_found' })
  })
  it('lists a shortage for a contract with an empty pool and creates nothing', async () => {
    const { server } = make()
    const out = await server.generatePaper(USER, 'SN', 1)
    expect(out).toEqual({
      ok: false,
      reason: 'shortage',
      shortages: [{ section: 'Bahagian A', need: 40, have: 0 }],
    })
    expect(Object.keys(JSON.parse(JSON.stringify(await server.history(USER))))).toHaveLength(0)
  })
  it('refuses a subject and kertas without a contract', async () => {
    const { server } = make()
    expect(await server.generatePaper(USER, 'MAT', 3)).toEqual({
      ok: false,
      reason: 'no_blueprint',
    })
  })
})

describe('result: choose-N, marks and rewards', () => {
  it('Latihan: counts the best N attempted questions of a choose section, whatever was ticked', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'sn-k2-2025-a', 'latihan')
    await server.submit(USER, attemptId, {
      idempotencyKey: 'k',
      changes: [
        // Bahagian B (choose 1 of 2): osmosis answered (2 of 4 points), photosynthesis blank,
        // the student ticked the blank one: in Latihan the tick never changes the score.
        {
          partId: 'sn2-osmosis-a',
          answer: {
            text: 'Air melalui membran separa telap ke dalam sel hingga sel menjadi turgid.',
          },
          rev: 1,
          savedAt: 1,
        },
      ],
      picks: { 'sn-k2-2025-a-s2': ['sn2-fotosintesis'] },
    })
    const { result } = await server.getResult(USER, attemptId)
    const b = result.sections[1]!
    expect(b.chooseN).toBe(1)
    expect(b.counted).toEqual(['sn2-osmosis'])
    expect(b.awarded).toBe(2)
    expect(b.marks).toBe(4)
    expect(result.max).toBe(result.sections[0]!.marks + 4)
    expect(result.score).toBe(2)
    expect(result.coins).toBe(4)
    expect(result.points).toBe(20)
  })
  it('grades a structured Matematik K2 paper per point with a shared Rajah group', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k2-2025-a', 'exam')
    const view = await server.getAttemptView(USER, attemptId)
    expect(view.groups).toHaveLength(1)
    expect([view.groups[0]!.from, view.groups[0]!.to]).toEqual([1, 2])
    await server.submit(USER, attemptId, {
      idempotencyKey: 'k',
      changes: [
        {
          partId: 'mat2-segitiga-v1-q1-a',
          answer: { steps: ['AC^2 = 12^2 + 5^2'], final: '13', unit: 'cm' },
          rev: 1,
          savedAt: 1,
        },
        {
          partId: 'mat2-garis-v1-c1',
          answer: { steps: ['2*4+3'], final: '11' },
          rev: 1,
          savedAt: 1,
        },
      ],
    })
    const { result } = await server.getResult(USER, attemptId)
    expect(result.questions.map((q) => q.awarded)).toEqual([2, 0, 0, 2, 0, 0])
    expect(result.max).toBe(9 + 6 + 6)
  })
  it('marks a part as awaiting review and flags the total as provisional', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'sn-k2-2025-a', 'exam')
    await server.submit(USER, attemptId, {
      idempotencyKey: 'k',
      changes: [
        {
          partId: 'sn2-sel-q1-a',
          answer: { text: 'Ia ialah bahagian yang mengawal semua aktiviti sel itu' },
          rev: 1,
          savedAt: 1,
        },
      ],
    })
    const { result } = await server.getResult(USER, attemptId)
    expect(result.provisional).toBe(true)
    expect(result.pendingReview).toBe(1)
  })
})
