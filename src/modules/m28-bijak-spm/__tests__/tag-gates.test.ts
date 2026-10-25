/**
 * DSKP-T05: the shared tag rule at the publish gate and on the stem-only revision path (AC-07.1 to
 * AC-07.5), through the real server and the real seeds. Nothing here changes the seed: the flagged
 * questions are the ones DSKP-T04 left flagged (`seed-tags.test.ts`).
 */
import { describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import { REVIEW_SEEDS } from '../data/review-seed'
import { BijakServer, MemoryStorage } from '../server/store'
import { SERVER_STORAGE_KEY } from '../server/store'
import { REVIEW_TOPIC } from '../domain/topic'
import { t13Tag } from './tag-fixtures'

const FLAGGED_MSG = 'Subjek dan tingkatan perlu ditetapkan.'

function make(storage = new MemoryStorage()) {
  const now = { t: 1_800_000_000_000 }
  return { server: new BijakServer({ storage, now: () => now.t }), storage, now }
}

/** A published (Terbit) question that is still flagged `perlu-semakan`. */
async function publishedFlagged(server: BijakServer): Promise<string> {
  const rows = await server.listBank({ tagReview: true })
  const row = rows.find((r) => r.status === 'terbit')
  if (!row) throw new Error('no published flagged seed question')
  return row.id
}

describe('publish ("Lulus & Terbit") runs the shared tag rule on every question of the unit', () => {
  it('publishing the real flagged mat2-rev-g1 is refused, naming the question (AC-07.5)', async () => {
    const { server } = make()
    // The seed is the real one: question 2 is flagged, question 1 is T1-T3 and fine.
    const seed = REVIEW_SEEDS.find((s) => s.key === 'mat2-rev-g1')!
    expect(seed.questions[1]!.curriculum.review).toBe('perlu-semakan')
    expect(seed.questions[0]!.curriculum.formOrigin).toBe('T1-T3')

    const detail = await server.getReviewItem('mat2-rev-g1')
    expect(detail.item.topic).toBe('Tingkatan 1-3 (di luar DSKP)')
    expect(detail.gate).toEqual([`Soalan 2: ${FLAGGED_MSG}`])

    const res = await server.reviewDecision('mat2-rev-g1', { action: 'terbit' })
    expect(res).toEqual({ ok: false, errors: [`Soalan 2: ${FLAGGED_MSG}`] })

    // nothing changed: still waiting, still not served
    expect((await server.getReviewItem('mat2-rev-g1')).item.status).toBe('semakan')
    expect(BANK.questions.has('mat2-rev-g1-q1')).toBe(false)
    expect(BANK.questions.has('mat2-rev-g1-q2')).toBe(false)
  })

  it('a single flagged review question is refused too, and Tolak / Minta Pembetulan are not blocked', async () => {
    const { server } = make()
    const flagged = (await server.listReviewQueue()).items.find(
      (i) => !i.isRevision && i.questionIds.length === 1 && i.topic === REVIEW_TOPIC,
    )
    if (!flagged) throw new Error('no single flagged review unit')
    const res = await server.reviewDecision(flagged.key, { action: 'terbit' })
    expect(res.ok).toBe(false)
    expect(res.errors).toEqual([`Soalan 1: ${FLAGGED_MSG}`])
    expect(
      (await server.reviewDecision(flagged.key, { action: 'betulkan', reason: 'Tag perlu dibetulkan' })).ok,
    ).toBe(true)
  })

  it('the same tag decides at the publish gate for a tagged unit', async () => {
    const { server } = make()
    // mat1-rev-1 is tagged (T1-T3) and has a key: nothing in the gate stops it
    const d = await server.getReviewItem('mat1-rev-1')
    expect(d.gate).toEqual([])
    expect((await server.reviewDecision('mat1-rev-1', { action: 'terbit' })).ok).toBe(true)
  })
})

describe('stem-only revision (F3): a flagged question cannot be re-published unchanged', () => {
  it('"Sunting" with a new stem is refused for a published flagged question', async () => {
    const { server } = make()
    const id = await publishedFlagged(server)
    const res = await server.reviseQuestion(id, 'Teks baharu yang lengkap.', 'Baiki ejaan')
    expect(res).toEqual({ ok: false, errors: [`Soalan: ${FLAGGED_MSG}`] })
    expect((await server.listReviewQueue()).items.some((i) => i.key === `v:${id}`)).toBe(false)
    expect((await server.getBankDetail(id)).pendingRevision).toBe(false)
  })

  it('a stem-only revision of a tagged question still works (and is approved)', async () => {
    const { server } = make()
    expect((await server.reviseQuestion('mat1-pub-1', 'Selesaikan $2x = 8$.', '')).ok).toBe(true)
    expect((await server.reviewDecision('v:mat1-pub-1', { action: 'terbit' })).ok).toBe(true)
  })

  it('a stem-only revision already waiting on a flagged question cannot be approved', async () => {
    // Built from a stored state: a revision made before the question was flagged (an older version
    // of the server let it through), so the decision path must close it as well.
    const { server: a, storage } = make()
    expect((await a.reviseQuestion('mat1-pub-1', 'Selesaikan $2x = 8$.', 'Lama')).ok).toBe(true)
    const flaggedId = await publishedFlagged(a)
    const doc = JSON.parse(storage.getItem(SERVER_STORAGE_KEY)!) as {
      review: Record<string, unknown>
    }
    doc.review[flaggedId] = doc.review['mat1-pub-1']
    storage.setItem(SERVER_STORAGE_KEY, JSON.stringify(doc))

    const server = new BijakServer({ storage })
    const detail = await server.getReviewItem(`v:${flaggedId}`)
    expect(detail.gate).toContain(`Soalan: ${FLAGGED_MSG}`)
    const res = await server.reviewDecision(`v:${flaggedId}`, { action: 'terbit' })
    expect(res).toEqual({ ok: false, errors: [`Soalan: ${FLAGGED_MSG}`] })
    expect((await server.getReviewItem(`v:${flaggedId}`)).item.status).toBe('semakan')
    // the live version keeps serving
    expect((await server.getBankDetail(flaggedId)).row.status).toBe('terbit')
  })
})

describe('tagging a flagged question in Sunting (full edit) clears the flag', () => {
  it('a complete tag passes revision and publish, and the marker is gone (AC-07.5)', async () => {
    const { server } = make()
    const id = await publishedFlagged(server)
    const e = await server.getBankEditable(id)
    expect(e.row.tagReview).toBe(true)
    // still flagged: the full edit is refused with the same message
    const refused = await server.reviseQuestionFull(id, e.question, e.stimulus, '')
    expect(refused.ok).toBe(false)
    expect(refused.errors).toContain(`Soalan: ${FLAGGED_MSG}`)

    const tagged = { ...e.question, tag: t13Tag({ subject: e.question.tag.subject, tp: e.question.tag.tp }) }
    expect((await server.reviseQuestionFull(id, tagged, e.stimulus, 'Ditanda semula')).ok).toBe(true)
    expect((await server.getReviewItem(`v:${id}`)).gate).toEqual([])
    expect((await server.reviewDecision(`v:${id}`, { action: 'terbit' })).ok).toBe(true)

    const row = (await server.getBankDetail(id)).row
    expect(row.tagReview).toBe(false)
    expect(row.topic).toBe('Tingkatan 1-3 (di luar DSKP)')
    expect((await server.listBank({ tagReview: true })).some((r) => r.id === id)).toBe(false)
  })
})
