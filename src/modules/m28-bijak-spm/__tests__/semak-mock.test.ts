import { describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import { isBlank } from '../domain/grading'
import type { PartAnswer } from '../domain/types'
import { BijakServer, MemoryStorage } from '../server/store'

/**
 * FR-MUR-13-6 / rule D12: the mock "Semak" behaves like the API (`attempts.service.ts` `check`): the same guard order, a blank check is refused
 * and saves nothing, only an answer-changing check counts, the cap freezes the answer, an edited answer shows no verdict until its own check.
 */
const USER = 7
const PAPER = 'sn-k2-2025-a'
const Q = 'sn2-sel-q1'
const A = 'sn2-sel-q1-a'
const B = 'sn2-sel-q1-b'
const BLANK = 'Jawab dahulu sebelum menyemak.'

const change = (partId: string, answer: PartAnswer, rev: number) => ({ partId, answer, rev, savedAt: 1 })
const text = (partId: string, t: string, rev: number) => change(partId, { text: t }, rev)

function make() {
  const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
  return server
}
async function latihan(server: BijakServer, paper = PAPER, mode: 'latihan' | 'exam' = 'latihan') {
  return (await server.startAttempt(USER, paper, mode)).attemptId
}

describe('mock Semak counts like the API', () => {
  it('a repeat check with no change uses no check; each changed answer does; the cap is 3 and then nothing changes', async () => {
    const server = make()
    const id = await latihan(server)
    expect((await server.checkQuestion(USER, id, Q, { changes: [text(A, 'satu', 1)] })).checksUsed).toBe(1)
    expect((await server.checkQuestion(USER, id, Q)).checksUsed).toBe(1)
    expect((await server.checkQuestion(USER, id, Q)).checksUsed).toBe(1)
    expect((await server.checkQuestion(USER, id, Q, { changes: [text(A, 'dua', 2)] })).checksUsed).toBe(2)
    expect((await server.checkQuestion(USER, id, Q, { changes: [text(A, 'tiga', 3)] })).checksUsed).toBe(3)
    const atCap = await server.checkQuestion(USER, id, Q, { changes: [text(A, 'empat', 4)] })
    expect(atCap.checksUsed).toBe(3)
    const view = await server.getAttemptView(USER, id)
    expect(view.attempt.answers[A]!.answer.text).toBe('tiga')
    expect(view.attempt.checkCounts).toEqual({ [Q]: 3 })
  })

  it('text the API defuses is the same answer: no extra check', async () => {
    const server = make()
    const id = await latihan(server)
    await server.checkQuestion(USER, id, Q, { changes: [text(A, '[Ca] ion', 1)] })
    expect((await server.checkQuestion(USER, id, Q, { changes: [text(A, 'Ca] ion', 2)] })).checksUsed).toBe(1)
  })

  it('an edit to a second Semak part of the same question counts', async () => {
    const server = make()
    const id = await latihan(server)
    await server.checkQuestion(USER, id, Q, { changes: [text(A, 'satu', 1)] })
    expect((await server.checkQuestion(USER, id, Q, { changes: [text(B, 'b', 1)] })).checksUsed).toBe(2)
  })
})

describe('mock blank Semak is refused like the API (lead ruling Q3)', () => {
  it('422 as bad_request "Jawab dahulu sebelum menyemak."; nothing saved, no check counted, no verdict', async () => {
    const server = make()
    const id = await latihan(server)
    const mixed = 'sn2-sel-q2'
    for (const [qid, changes] of [
      [Q, []],
      [Q, [text(A, '   ', 1)]],
      [mixed, [text('sn2-sel-q2-a', '', 1)]],
    ] as const) {
      await expect(server.checkQuestion(USER, id, qid, { changes: [...changes], flags: [qid] })).rejects.toMatchObject({
        code: 'bad_request',
        message: BLANK,
      })
    }
    const view = await server.getAttemptView(USER, id)
    expect(view.checks).toEqual([])
    expect(view.attempt.checkCounts ?? {}).toEqual({})
    expect(view.attempt.answers).toEqual({})
    expect(view.attempt.flags).toEqual([])
  })

  it('an mcq with no choice is blank; a choice is not', async () => {
    const server = make()
    const id = await latihan(server, 'mat-k1-2025-a')
    const q = (await server.getAttemptView(USER, id)).questions[0]!.id
    await expect(server.checkQuestion(USER, id, q)).rejects.toMatchObject({ message: BLANK })
    const res = await server.checkQuestion(USER, id, q, { changes: [change(q, { choice: 'zz' }, 1)] })
    expect(res.checksUsed).toBe(1)
  })

  it('a stored row that holds only the DM-68 marker {revealed:true} is unanswered: blank, not attempted, not scored', async () => {
    expect(isBlank({ revealed: true })).toBe(true)
    expect(isBlank({ revealed: true }, 'short_text')).toBe(true)
    const server = make()
    const id = await latihan(server)
    // the marker alone does not make the part answered
    await expect(server.checkQuestion(USER, id, Q, { changes: [change(A, { revealed: true }, 0)] })).rejects.toMatchObject({ message: BLANK })
    // the same rows reach submit: the question is not attempted and earns nothing
    await server.saveAnswers(USER, id, { changes: [change(A, { revealed: true }, 0), change(B, { revealed: true }, 0)] })
    await server.submit(USER, id, { idempotencyKey: 'k', changes: [] })
    const q = (await server.getResult(USER, id)).result.questions.find((x) => x.questionId === Q)!
    expect(q.attempted).toBe(false)
    expect(q.awarded).toBe(0)
  })
})

describe('mock Semak guard order matches the API', () => {
  it('unknown attempt 404, someone else 403, exam mode 403, closed attempt (API 409 CONFLICT) bad_request, foreign question 404, no Semak part 403', async () => {
    const server = make()
    const id = await latihan(server)
    await expect(server.checkQuestion(USER, 'nope', Q)).rejects.toMatchObject({ code: 'not_found' })
    await expect(server.checkQuestion(99, id, Q)).rejects.toMatchObject({ code: 'forbidden', message: 'Akses ditolak' })
    const exam = await latihan(server, 'mat-k1-2025-a', 'exam')
    const examQ = (await server.getAttemptView(USER, exam)).questions[0]!.id
    await expect(server.checkQuestion(USER, exam, examQ)).rejects.toMatchObject({ code: 'forbidden', message: 'Skema hanya didedahkan selepas Hantar' })
    await expect(server.checkQuestion(USER, id, 'sn2-laju-v1')).rejects.toMatchObject({ code: 'forbidden', message: 'Skema hanya didedahkan selepas Hantar' })
    expect(BANK.questions.has('mat2-segitiga-v1-q1')).toBe(true)
    await expect(server.checkQuestion(USER, id, 'mat2-segitiga-v1-q1')).rejects.toMatchObject({ code: 'not_found', message: 'Soalan tidak ditemui' })
    // a blank, closed attempt is refused as closed first
    await server.submit(USER, id, { idempotencyKey: 'k', changes: [] })
    await expect(server.checkQuestion(USER, id, Q)).rejects.toMatchObject({ code: 'bad_request', message: 'Percubaan sudah tamat' })
  })
})

describe('mock view after a check (API shownChecks)', () => {
  it('shows the check while the answers are the checked ones; an edit hides it until its own Semak', async () => {
    const server = make()
    const id = await latihan(server)
    await server.checkQuestion(USER, id, Q, { changes: [text(A, 'satu', 1)] })
    expect((await server.getAttemptView(USER, id)).checks.map((c) => c.questionId)).toEqual([Q])
    await server.saveAnswers(USER, id, { changes: [text(A, 'dua', 2)] })
    const edited = await server.getAttemptView(USER, id)
    expect(edited.checks).toEqual([])
    expect(edited.attempt.checkCounts).toEqual({ [Q]: 1 })
    expect((await server.checkQuestion(USER, id, Q)).checksUsed).toBe(2)
    expect((await server.getAttemptView(USER, id)).checks.map((c) => c.questionId)).toEqual([Q])
  })
})
