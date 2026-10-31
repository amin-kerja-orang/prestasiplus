import { describe, expect, it } from 'vitest'

import { parsePaper } from '../admin/intake/ai'
import { SAMPLE_PAGES } from '../admin/intake/lib/sample-paper'
import type { IntakeBatch } from '../admin/intake/types'
import { BijakServer, MemoryStorage } from '../server/store'

/**
 * R1 intake parity I6, I7 (V2 "Terima (A)", "Tolak (R)", "Terima semua yang belum disemak"): a question of a
 * Draf batch is decided on the batch page. Accept makes a Draf question and removes it from the batch.
 */
const meta = {
  subject: 'MAT',
  kertas: 2,
  year: 2025,
  paperType: 'Percubaan',
  source: 'Sekolah contoh',
  fileName: 'contoh.pdf',
  fileHash: 'h1',
  pageCount: 2,
} as never

async function readyBatch(): Promise<{ s: BijakServer; b: IntakeBatch }> {
  const s = new BijakServer({ storage: new MemoryStorage() })
  const parsed = parsePaper({ pages: SAMPLE_PAGES, subject: 'MAT', kertas: 2 })
  const created = await s.createIntakeBatch(1, meta, parsed, SAMPLE_PAGES)
  const b: IntakeBatch = await s.getIntakeBatch(created.id)
  b.questions = b.questions.map((x) => ({
    ...x,
    confirmed: [...x.lowFields],
    tag: { ...x.tag, unit: x.tag.unit ?? 'MAT-T4-02', unitLabel: 'u', sp: x.tag.sp.length ? x.tag.sp : ['1.1'] },
  }))
  b.stimuli = b.stimuli.map((x) => ({ ...x, alt: x.alt || 'Rajah segi tiga' }))
  await s.saveExtracted(b.id, { questions: b.questions, stimuli: b.stimuli })
  return { s, b: await s.getIntakeBatch(b.id) }
}

describe('intake item actions (I6)', () => {
  it('Tolak needs a reason; with one the question leaves the batch', async () => {
    const { s, b } = await readyBatch()
    const first = b.questions[0]!
    const noReason = await s.decideIntakeItem(b.id, first.id, { action: 'tolak' })
    expect(noReason.ok).toBe(false)
    expect((await s.getIntakeBatch(b.id)).questions).toHaveLength(b.questions.length)
    const done = await s.decideIntakeItem(b.id, first.id, { action: 'tolak', reason: 'Salah salin' })
    expect(done.ok).toBe(true)
    expect(done.batch.questions.map((x) => x.id)).not.toContain(first.id)
  })

  it('Terima removes the question from the batch', async () => {
    const { s, b } = await readyBatch()
    const first = b.questions[0]!
    const r = await s.decideIntakeItem(b.id, first.id, { action: 'terbit' })
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.batch.questions.map((x) => x.id)).not.toContain(first.id)
    expect(r.batch.questions).toHaveLength(b.questions.length - 1)
  })

  it('Terima is refused with the gate issues when the question is incomplete', async () => {
    const { s, b } = await readyBatch()
    const first = b.questions[0]!
    first.stem = ''
    first.parts = []
    first.options = []
    await s.saveExtracted(b.id, { questions: [first, ...b.questions.slice(1)], stimuli: b.stimuli })
    const r = await s.decideIntakeItem(b.id, first.id, { action: 'terbit' })
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
    expect((await s.getIntakeBatch(b.id)).questions.map((x) => x.id)).toContain(first.id)
  })
})

describe('Terima semua yang belum disemak (I7)', () => {
  it('accepts the confirmed questions and lists the low-confidence ones as skipped', async () => {
    const { s, b } = await readyBatch()
    const low = b.questions[0]!
    low.lowFields = ['stem']
    low.confirmed = []
    await s.saveExtracted(b.id, { questions: [low, ...b.questions.slice(1)], stimuli: b.stimuli })
    const r = await s.acceptUnreviewed(b.id)
    expect(r.skipped).toEqual([{ id: low.id, reason: 'BELOW_THRESHOLD' }])
    expect(r.done + r.skipped.length).toBe(b.questions.length)
    expect(r.batch.questions.map((x) => x.id)).toContain(low.id)
  })
})
