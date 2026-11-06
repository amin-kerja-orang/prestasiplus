/** S3-T06: the in-memory server follows the API rules for a Kertas Subjektif (AC-MUR-13-20, AC-MUR-13-21, 46 section 3.4/3.5). */
import { describe, expect, it } from 'vitest'

import { leavesOf } from '../domain/paper-model'
import { BijakServer, MemoryStorage } from '../server/store'

const USER = 7
const PUBLISHED = ['subj-sej-k2-selangor', 'subj-sn-k2-johor']
const DRAFT = 'subj-mat-k2-kedah-draf'

function make(): BijakServer {
  return new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
}

async function submitted(server: BijakServer): Promise<string> {
  const { attemptId } = await server.startAttempt(USER, PUBLISHED[0]!, 'latihan')
  // Something typed in every leaf, so a part that waits for a person is `belum_dimarkah` (not blank).
  const view = await server.getAttemptView(USER, attemptId)
  const leaves = view.questions.flatMap((q) => leavesOf(q.parts ?? []).map((l) => l.id))
  const changes = leaves.map((partId, i) => ({
    partId,
    answer: { text: 'Jawapan saya', final: 'x' },
    rev: i + 1,
    savedAt: 1,
  }))
  await server.submit(USER, attemptId, { idempotencyKey: 'k', changes, auto: false })
  return attemptId
}

const partsOf = (r: Awaited<ReturnType<BijakServer['getResult']>>) =>
  r.result.questions.flatMap((q) => q.parts)
const selfMarkable = (p: unknown): boolean => !!(p as { selfMarkable?: boolean }).selfMarkable

describe('AC-MUR-13-20: the list', () => {
  it('lists the 2 published papers with surface and examBoard, never the draft', async () => {
    const rows = await make().listPapers(USER, 'subjektif')
    expect(rows.map((r) => r.id).sort()).toEqual([...PUBLISHED].sort())
    expect(rows.every((r) => r.surface === 'subjektif' && !!r.examBoard)).toBe(true)
    expect(rows.find((r) => r.id === DRAFT)).toBeUndefined()
  })

  it('keeps the Simulasi list free of Kertas Subjektif papers', async () => {
    const server = make()
    for (const rows of [await server.listPapers(USER), await server.listPapers(USER, 'simulasi')])
      expect(rows.some((r) => r.id.startsWith('subj-'))).toBe(false)
  })

  it('answers not_found for the draft id', async () => {
    await expect(make().startAttempt(USER, DRAFT, 'latihan')).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})

describe('a subjektif sitting', () => {
  it('is latihan with no deadline whatever mode is sent, and resumes the open one', async () => {
    const server = make()
    const { attemptId } = await server.startAttempt(USER, PUBLISHED[0]!, 'exam')
    const view = await server.getAttemptView(USER, attemptId)
    expect(view.attempt.mode).toBe('latihan')
    expect(view.attempt.deadline).toBeNull()
    expect(view.attempt.paperKind).toBe('subjektif')
    expect((await server.startAttempt(USER, PUBLISHED[0]!, 'latihan')).attemptId).toBe(attemptId)
  })

  it('has no Semak (403)', async () => {
    const server = make()
    const { attemptId } = await server.startAttempt(USER, PUBLISHED[0]!, 'latihan')
    const view = await server.getAttemptView(USER, attemptId)
    await expect(
      server.checkQuestion(USER, attemptId, view.questions[0]!.id),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('refuses the result before Hantar', async () => {
    const server = make()
    const { attemptId } = await server.startAttempt(USER, PUBLISHED[0]!, 'latihan')
    await expect(server.getResult(USER, attemptId)).rejects.toMatchObject({ code: 'not_submitted' })
  })
})

describe('AC-MUR-13-21: the scheme is withheld unless asked for', () => {
  it('result carries no scheme text or points without withScheme, and the scheme with it', async () => {
    const server = make()
    const id = await submitted(server)
    const parts = partsOf(await server.getResult(USER, id))
    expect(parts.length).toBeGreaterThan(0)
    for (const p of parts) {
      expect(p.scheme).toEqual({ marks: p.marks })
      expect(p.points).toEqual([])
    }
    const rich = partsOf(await server.getResult(USER, id, true)).filter(
      (p) => Object.keys(p.scheme).length > 1,
    )
    expect(rich.length).toBeGreaterThan(0)
  })

  it('self-mark keeps the scheme only with withScheme', async () => {
    const server = make()
    const id = await submitted(server)
    const open = partsOf(await server.getResult(USER, id)).find(selfMarkable)!
    expect(open).toBeDefined()
    const without = await server.selfMark(USER, id, { partId: open.partId, mark: 1 })
    expect(
      without.result.questions
        .flatMap((q) => q.parts)
        .every((p) => Object.keys(p.scheme).length === 1),
    ).toBe(true)
    const withIt = await server.selfMark(USER, id, { partId: open.partId, mark: 1 }, true)
    expect(
      withIt.result.questions.flatMap((q) => q.parts).some((p) => Object.keys(p.scheme).length > 1),
    ).toBe(true)
  })

  it('clamps a self-mark to the part marks (AC-MUR-13-22)', async () => {
    const server = make()
    const id = await submitted(server)
    const open = partsOf(await server.getResult(USER, id)).find(selfMarkable)!
    const out = await server.selfMark(USER, id, { partId: open.partId, mark: open.marks + 5 })
    expect(out.awarded).toBe(open.marks)
  })

  it('refuses a self-mark on an automatically marked part with the BM line', async () => {
    const server = make()
    const id = await submitted(server)
    const auto = partsOf(await server.getResult(USER, id)).find((p) => !selfMarkable(p))
    if (!auto) return
    await expect(server.selfMark(USER, id, { partId: auto.partId, mark: 1 })).rejects.toMatchObject({
      message: 'Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.',
    })
  })

  it('does not change the scheme of a Simulasi paper', async () => {
    const server = make()
    const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
    await server.submit(USER, attemptId, { idempotencyKey: 'k', changes: [], auto: false })
    expect(
      partsOf(await server.getResult(USER, attemptId)).some((p) => Object.keys(p.scheme).length > 1),
    ).toBe(true)
  })
})
