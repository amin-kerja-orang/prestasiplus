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

describe('two decisions at the same time cannot both succeed (the gate loads the catalogue first)', () => {
  const okCount = (rs: { ok: boolean }[]): number => rs.filter((r) => r.ok).length

  it('Lulus & Terbit and Tolak together on a unit: exactly one wins and the record agrees', async () => {
    for (const order of ['terbit-first', 'tolak-first'] as const) {
      const { server } = make()
      const terbit = () => server.reviewDecision('mat1-rev-2', { action: 'terbit' })
      const tolak = () => server.reviewDecision('mat1-rev-2', { action: 'tolak', reason: 'Pendua' })
      const rs = await Promise.all(
        order === 'terbit-first' ? [terbit(), tolak()] : [tolak(), terbit()],
      )
      expect(okCount(rs)).toBe(1)
      const lost = rs.find((r) => !r.ok)!
      expect(lost.errors).toEqual(['Item ini tidak lagi menunggu semakan'])
      const detail = await server.getReviewItem('mat1-rev-2')
      const actions = detail.history.map((h) => h.action)
      // never both "Diterbitkan" and "Ditolak" on the same record
      expect(actions.includes('Diterbitkan') !== actions.includes('Ditolak')).toBe(true)
      expect(BANK.questions.has('mat1-rev-2')).toBe(detail.item.status === 'terbit')
      BANK.questions.delete('mat1-rev-2')
    }
  })

  it('two Lulus & Terbit on a unit publish once', async () => {
    const { server } = make()
    const rs = await Promise.all([
      server.reviewDecision('mat1-rev-1', { action: 'terbit' }),
      server.reviewDecision('mat1-rev-1', { action: 'terbit' }),
    ])
    expect(okCount(rs)).toBe(1)
    const h = (await server.getReviewItem('mat1-rev-1')).history.map((x) => x.action)
    expect(h.filter((a) => a === 'Diterbitkan')).toHaveLength(1)
  })

  it('two Lulus & Terbit on a revision (v:) publish the new version once', async () => {
    for (const full of [false, true]) {
      const { server } = make()
      const id = 'mat2-kuadratik-v1'
      if (full) {
        const e = await server.getBankEditable(id)
        await server.reviseQuestionFull(
          id,
          { ...e.question, stem: `${e.question.stem} Ulang.` },
          undefined,
          '',
        )
      } else {
        await server.reviseQuestion(id, 'Faktorkan $x^2 - 5x + 6$.', '')
      }
      const rs = await Promise.all([
        server.reviewDecision(`v:${id}`, { action: 'terbit' }),
        server.reviewDecision(`v:${id}`, { action: 'terbit' }),
      ])
      expect(okCount(rs)).toBe(1)
      expect(rs.find((r) => !r.ok)!.errors).toEqual(['Item tiada dalam baris gilir'])
      const d = await server.getBankDetail(id)
      expect(d.row.version).toBe(2)
      expect(d.history.filter((h) => h.action === 'Diterbitkan')).toHaveLength(1)
      expect(d.history.filter((h) => h.action === 'Diarkibkan (digantikan)')).toHaveLength(1)
    }
  })

  it('Terbit and Tolak together on a revision: exactly one wins', async () => {
    const { server } = make()
    await server.reviseQuestion('mat1-pub-1', 'Selesaikan $2x = 8$.', '')
    const rs = await Promise.all([
      server.reviewDecision('v:mat1-pub-1', { action: 'terbit' }),
      server.reviewDecision('v:mat1-pub-1', { action: 'tolak', reason: 'Tidak sesuai' }),
    ])
    expect(okCount(rs)).toBe(1)
    const h = (await server.getBankDetail('mat1-pub-1')).history.map((x) => x.action)
    expect(h.includes('Diarkibkan (digantikan)') !== h.includes('Ditolak')).toBe(true)
  })

  it('two Sunting submits together create one new version', async () => {
    const { server } = make()
    const id = 'mat2-kuadratik-v1'
    const e = await server.getBankEditable(id)
    const rs = await Promise.all([
      server.reviseQuestionFull(id, { ...e.question, stem: `${e.question.stem} A.` }, undefined, ''),
      server.reviseQuestionFull(id, { ...e.question, stem: `${e.question.stem} B.` }, undefined, ''),
    ])
    expect(okCount(rs)).toBe(1)
    expect(rs.find((r) => !r.ok)!.errors).toEqual(['Sudah ada versi baharu menunggu semakan'])
    const created = (await server.getReviewItem(`v:${id}`)).history.filter((h) =>
      h.action.startsWith('Versi'),
    )
    expect(created).toHaveLength(1)
  })

  it('a stem-only revision whose question has gone is not_found, not published', async () => {
    const { server: a, storage } = make()
    await a.reviseQuestion('mat1-pub-1', 'Selesaikan $2x = 8$.', '')
    const doc = JSON.parse(storage.getItem(SERVER_STORAGE_KEY)!) as {
      review: Record<string, unknown>
    }
    doc.review['tiada-soalan'] = doc.review['mat1-pub-1']
    storage.setItem(SERVER_STORAGE_KEY, JSON.stringify(doc))
    const server = new BijakServer({ storage })
    await expect(
      server.reviewDecision('v:tiada-soalan', { action: 'terbit' }),
    ).rejects.toMatchObject({ code: 'not_found' })
  })
})
