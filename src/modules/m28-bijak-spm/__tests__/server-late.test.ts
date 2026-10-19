import { describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import { leavesOf } from '../domain/paper-model'
import {
  BijakServer,
  GRACE_SECONDS,
  LATE_SYNC_WINDOW_MS,
  MAX_CHECKS_PER_QUESTION,
  MemoryStorage,
} from '../server/store'

const USER = 11
const MIN = 60_000

function make() {
  const now = { t: 1_800_000_000_000 }
  const server = new BijakServer({ storage: new MemoryStorage(), now: () => now.t })
  return { server, now }
}

const correct = (qid: string): string => {
  const s = BANK.schemes.get(qid)!
  if (s.kind !== 'option') throw new Error('mcq')
  return s.correct
}

describe('late sync and closed attempts (AC-05.4)', () => {
  async function swept() {
    const { server, now } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    const view = await server.getAttemptView(USER, attemptId)
    const q = view.questions.map((x) => x.id)
    const deadline = view.attempt.deadline!
    // the device goes offline with an answer it saved locally before the deadline
    now.t = deadline + (GRACE_SECONDS + 5) * 1000
    return { server, now, attemptId, q, deadline }
  }

  it('closes at the deadline plus grace, caps the recorded lateness, and says closed on save', async () => {
    const { server, now, attemptId, q } = await swept()
    now.t += 3 * 60 * MIN
    const res = await server.saveAnswers(USER, attemptId, {
      changes: [
        {
          partId: q[0]!,
          answer: { choice: correct(q[0]!) },
          rev: 1,
          savedAt: now.t - 10 * 60 * MIN,
        },
      ],
    })
    expect(res.closed).toBe(true)
    const { attempt } = await server.getResult(USER, attemptId)
    expect(attempt.status).toBe('auto_submitted')
    expect(attempt.lateBySeconds).toBeLessThanOrEqual(GRACE_SECONDS)
  })

  it('accepts answers saved before the deadline when they sync later, and grades again', async () => {
    const { server, attemptId, q, deadline } = await swept()
    expect((await server.getResult(USER, attemptId)).result.score).toBe(0)
    const res = await server.saveAnswers(USER, attemptId, {
      changes: [
        { partId: q[0]!, answer: { choice: correct(q[0]!) }, rev: 1, savedAt: deadline - 5000 },
        { partId: q[1]!, answer: { choice: correct(q[1]!) }, rev: 1, savedAt: deadline - 1000 },
      ],
    })
    expect(res).toMatchObject({ closed: true, regraded: true })
    expect((await server.getResult(USER, attemptId)).result.score).toBe(2)
  })

  it('refuses answers stamped after the deadline, and a device clock in the future', async () => {
    const { server, attemptId, q, deadline } = await swept()
    const res = await server.saveAnswers(USER, attemptId, {
      changes: [
        { partId: q[0]!, answer: { choice: correct(q[0]!) }, rev: 1, savedAt: deadline + 1000 },
        // claims to be saved before the deadline only by lying forward is impossible: clamped to now
        {
          partId: q[1]!,
          answer: { choice: correct(q[1]!) },
          rev: 1,
          savedAt: Number.MAX_SAFE_INTEGER,
        },
      ],
    })
    expect(res.closed).toBe(true)
    expect(res.regraded).toBeUndefined()
    expect((await server.getResult(USER, attemptId)).result.score).toBe(0)
  })

  it('stops late sync after 24 hours', async () => {
    const { server, now, attemptId, q, deadline } = await swept()
    now.t = deadline + LATE_SYNC_WINDOW_MS + MIN
    const res = await server.saveAnswers(USER, attemptId, {
      changes: [
        { partId: q[0]!, answer: { choice: correct(q[0]!) }, rev: 1, savedAt: deadline - 1000 },
      ],
    })
    expect(res).toMatchObject({ closed: true })
    expect(res.regraded).toBeUndefined()
  })

  it('a submit that arrives after the sweep reports closed and still carries the early answers', async () => {
    const { server, attemptId, q, deadline } = await swept()
    const out = await server.submit(USER, attemptId, {
      idempotencyKey: 'late',
      changes: [],
      auto: true,
      answers: {
        [q[0]!]: { answer: { choice: correct(q[0]!) }, rev: 1, savedAt: deadline - 2000 },
      },
    })
    expect(out).toMatchObject({ closed: true, regraded: true })
    expect((await server.getResult(USER, attemptId)).result.score).toBe(1)
  })

  it('a submitted attempt says closed and is not changed by a later save', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    await server.submit(USER, attemptId, { idempotencyKey: 'k', changes: [] })
    const q = (await server.getAttemptView(USER, attemptId)).questions[0]!.id
    const res = await server.saveAnswers(USER, attemptId, {
      changes: [{ partId: q, answer: { choice: correct(q) }, rev: 1, savedAt: 1 }],
    })
    expect(res.closed).toBe(true)
    expect((await server.getResult(USER, attemptId)).result.score).toBe(0)
  })
})

describe('offline resubmit', () => {
  it('fails while offline and succeeds once on retry, recording one submission', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    const q = (await server.getAttemptView(USER, attemptId)).questions[0]!.id
    const payload = {
      idempotencyKey: 'again',
      changes: [],
      answers: { [q]: { answer: { choice: correct(q) }, rev: 1, savedAt: 1 } },
    }
    server.setOffline(true)
    await expect(server.submit(USER, attemptId, payload)).rejects.toMatchObject({ code: 'offline' })
    await expect(server.submit(USER, attemptId, payload)).rejects.toMatchObject({ code: 'offline' })
    server.setOffline(false)
    const out = await server.submit(USER, attemptId, payload)
    expect(out.closed).toBeUndefined()
    expect((await server.getResult(USER, attemptId)).result.score).toBe(1)
    const again = await server.submit(USER, attemptId, payload)
    expect(again.closed).toBe(true)
    expect((await server.history(USER)).filter((h) => h.status === 'submitted')).toHaveLength(1)
  })
})

describe('no answer key leaves the server before submit', () => {
  it.each(['mat-k2-2025-a', 'sn-k2-2025-a', 'mat-k1-2025-a'])(
    '%s view carries no scheme text',
    async (paperId) => {
      const { server } = make()
      const { attemptId } = await server.startAttempt(USER, paperId, 'exam')
      const view = await server.getAttemptView(USER, attemptId)
      const json = JSON.stringify(view)
      for (const word of [
        '"final"',
        '"model"',
        '"display"',
        'finalDisplay',
        '"accept"',
        '"correct"',
        'tolerance',
        '"reason"',
      ]) {
        expect(json, word).not.toContain(word)
      }
      // none of the long scheme strings of this paper appears anywhere in the served view
      for (const s of view.questions) {
        const q = BANK.questions.get(s.id)!
        const ids = q.mcq ? [q.id] : leavesOf(q.parts ?? []).map((l) => l.id)
        for (const id of ids) {
          const scheme = BANK.schemes.get(id)!
          const texts =
            scheme.kind === 'option'
              ? [scheme.reason]
              : scheme.kind === 'points'
                ? [scheme.model, scheme.final?.display, ...scheme.points.map((p) => p.label)]
                : []
          for (const t of texts)
            if (t && t.length >= 15) expect(json).not.toContain(JSON.stringify(t).slice(1, -1))
        }
      }
    },
  )
})

describe('Latihan check cap (NFR-05)', () => {
  it('locks a question after three checks; later payloads cannot change the answer', async () => {
    const { server } = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'latihan')
    const q = (await server.getAttemptView(USER, attemptId)).questions[0]!.id
    const right = correct(q)
    const save = (choice: string, rev: number) => ({
      changes: [{ partId: q, answer: { choice }, rev, savedAt: 1 }],
    })
    for (let i = 1; i <= MAX_CHECKS_PER_QUESTION; i++) {
      const r = await server.checkQuestion(USER, attemptId, q, save(`${q}-wrong`, i))
      expect(r.awarded).toBe(0)
    }
    await server.saveAnswers(USER, attemptId, save(right, 9))
    const fourth = await server.checkQuestion(USER, attemptId, q, save(right, 10))
    expect(fourth.awarded).toBe(0)
    expect(fourth.parts[0]!.scheme.correctOption).toBe(right)
    expect(server.debugSaved(attemptId)[q]!.answer.choice).toBe(`${q}-wrong`)
  })
})
