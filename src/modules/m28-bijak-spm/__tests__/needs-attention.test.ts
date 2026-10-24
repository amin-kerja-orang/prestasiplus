import { describe, expect, it } from 'vitest'

import { needsAttention } from '../domain/paper-model'
import { BijakServer, MemoryStorage } from '../server/store'

const q = (
  counted: boolean,
  awarded: number,
  marks: number,
  statuses: ('betul' | 'separa' | 'salah' | 'belum_dimarkah')[] = ['betul'],
) => ({ counted, awarded, marks, parts: statuses.map((status) => ({ status })) })

describe('needsAttention: Semakan tab "Perlu perhatian" (FB-049)', () => {
  it('lists a counted question that lost marks', () => {
    expect(needsAttention(q(true, 1, 6, ['separa']))).toBe(true)
    expect(needsAttention(q(true, 0, 6, ['salah']))).toBe(true)
  })
  it('lists a counted question that waits for a teacher', () => {
    expect(needsAttention(q(true, 0, 10, ['belum_dimarkah']))).toBe(true)
  })
  it('does not list a full-mark question', () => {
    expect(needsAttention(q(true, 6, 6))).toBe(false)
  })
  it('never lists a question marked "Tidak dikira", whatever its marks', () => {
    expect(needsAttention(q(false, 0, 6, ['salah']))).toBe(false)
    expect(needsAttention(q(false, 0, 10, ['belum_dimarkah']))).toBe(false)
  })
  it('gives the same answer on a real all-wrong paper: only counted questions stay', async () => {
    const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
    const { attemptId } = await server.startAttempt(7, 'mat-k2-2025-a', 'exam')
    await server.submit(7, attemptId, {
      idempotencyKey: 'k',
      changes: [
        { partId: 'mat2-segitiga-v1-q1-a', answer: { final: '1' }, rev: 1, savedAt: 1 },
        { partId: 'mat2-kuadratik-v1-a', answer: { final: '1' }, rev: 2, savedAt: 2 },
      ],
    })
    const { result } = await server.getResult(7, attemptId)
    const listed = result.questions.filter(needsAttention)
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.every((x) => x.counted)).toBe(true)
    expect(result.questions.some((x) => !x.counted)).toBe(true)
    expect(listed.length).toBeLessThan(result.questions.length)
  })
})
