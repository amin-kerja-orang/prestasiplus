/**
 * DSKP-T05: when the catalogue cannot be loaded, read-only listings still render (topics empty, a
 * warning logged) while every gate and every path that changes data fails closed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDskpCatalog, dskpCatalog } from '@/modules/m03-curriculum'

import { BANK } from '../data/registry'
import { T1_T3_TOPIC } from '../domain/topic'
import { setDskpCatalogForTests } from '../lib/dskp-source'
import { BijakServer, MemoryStorage } from '../server/store'

const down = () =>
  createDskpCatalog(
    Object.fromEntries(
      dskpCatalog
        .subjects()
        .map((s) => [s.code, () => Promise.reject(new Error('rangkaian terputus'))]),
    ),
  )

const snapshot = {
  questions: new Map(BANK.questions),
  schemes: new Map(BANK.schemes),
  stimuli: new Map(BANK.stimuli),
  groups: new Map(BANK.groups),
}
afterEach(() => {
  setDskpCatalogForTests()
  vi.restoreAllMocks()
  for (const [k, m] of [
    ['questions', BANK.questions],
    ['schemes', BANK.schemes],
    ['stimuli', BANK.stimuli],
    ['groups', BANK.groups],
  ] as const) {
    m.clear()
    for (const [id, v] of snapshot[k] as Map<string, never>) (m as Map<string, never>).set(id, v)
  }
})

describe('catalogue unavailable', () => {
  it('listings still render with empty topics and warn; T1-T3 rows keep their copy', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setDskpCatalogForTests(down())

    const rows = await server.listBank({ status: 'semua' })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.find((r) => r.id === 'mat1-pub-1')).toMatchObject({
      topic: T1_T3_TOPIC,
      formOrigin: 'T1-T3',
    })
    const tagged = rows.find((r) => r.id === 'mat2-kuadratik-v1')!
    expect(tagged).toMatchObject({
      topic: '',
      unitTitle: null,
      spCodes: ['1.1.6'],
      tagReview: false,
    })
    expect(warn).toHaveBeenCalled()

    // tag filters still work on the stored ids
    expect((await server.listBank({ status: 'semua', tagReview: true })).length).toBeGreaterThan(0)
    expect((await server.listReviewQueue()).items.length).toBeGreaterThan(0)
    expect((await server.getBankDetail('mat2-kuadratik-v1')).row.topic).toBe('')
    expect((await server.getBankEditable('mat2-kuadratik-v1')).row.id).toBe('mat2-kuadratik-v1')
    expect((await server.getPaperEditor('kp-seed-1')).questions.length).toBeGreaterThan(0)
  })

  it('the queue still lists with tag fields and tag filters when the catalogue is down', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const id = 'mat2-kuadratik-v1'
    const e = await server.getBankEditable(id)
    expect(
      (
        await server.reviseQuestionFull(
          id,
          { ...e.question, stem: `${e.question.stem} Ulang.` },
          undefined,
          '',
        )
      ).ok,
    ).toBe(true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setDskpCatalogForTests(down())

    const all = await server.listReviewQueue({ status: 'semua' })
    const rev = all.items.find((i) => i.key === `v:${id}`)!
    // the unit title needs the catalogue; the stored ids and codes do not
    expect(rev).toMatchObject({
      formOrigin: 'T4',
      unitTitle: null,
      topic: '',
      spCodes: ['1.1.6'],
      tp: 2,
      tagReview: false,
    })
    expect(warn).toHaveBeenCalled()
    const t4 = await server.listReviewQueue({ status: 'semua', formOrigin: 'T4' })
    expect(t4.items.map((i) => i.key)).toEqual([`v:${id}`])
    const t13 = await server.listReviewQueue({ status: 'semua', formOrigin: 'T1-T3' })
    expect(t13.items.length).toBeGreaterThan(0)
    expect(t13.items.every((i) => i.formOrigin === 'T1-T3' || i.key === 'mat2-rev-g1')).toBe(true)
    expect(t13.items.find((i) => i.key === 'mat1-rev-1')?.topic).toBe(T1_T3_TOPIC)
  })

  it('the gates and the changes fail closed: no publish, no new version, nothing written', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const id = 'mat2-kuadratik-v1'
    const e = await server.getBankEditable(id)
    const edited = { ...e.question, stem: `${e.question.stem} Ulang.` }
    expect((await server.reviseQuestionFull(id, edited, undefined, '')).ok).toBe(true)
    const other = (await server.getBankEditable('mat2-kuadratik-v2')).question
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setDskpCatalogForTests(down())

    // publishing the pending revision (its tag has a catalogue unit) cannot be checked: refused
    await expect(server.reviewDecision(`v:${id}`, { action: 'terbit' })).rejects.toMatchObject({
      name: 'DskpLoadError',
    })
    expect((await server.listReviewQueue()).items.some((i) => i.key === `v:${id}`)).toBe(true)
    expect((await server.getBankDetail(id)).row.version).toBe(1)

    // a new Sunting submit and the review detail (it carries the gate) are refused too
    await expect(
      server.reviseQuestionFull('mat2-kuadratik-v2', other, undefined, ''),
    ).rejects.toMatchObject({ name: 'DskpLoadError' })
    await expect(server.getReviewItem(`v:${id}`)).rejects.toMatchObject({ name: 'DskpLoadError' })

    // Tolak does not need the catalogue and still works
    expect(
      (await server.reviewDecision(`v:${id}`, { action: 'tolak', reason: 'Ditolak' })).ok,
    ).toBe(true)
  })
})
