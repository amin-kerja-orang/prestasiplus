import { BijakPaperCoverSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type BijakQuestionSource, BijakPapersAttemptSource } from '../../src/modules/bijak/papers'
import { pinKey } from '../../src/modules/bijak/papers/ports'
import { bootPapersApp, loginAs, type Client, type PapersTestApp } from './helpers'

/** PO decision 12, FR-QA-47, 60 API-BIJAK-02: the cover says `unavailable` exactly when a new sitting would be refused. */
describe('cover unavailable (API-BIJAK-02)', () => {
  let t: PapersTestApp
  let student: Client
  let source: BijakPapersAttemptSource
  const archived = new Set<string>()
  const takenDown = new Set<string>()

  beforeAll(async () => {
    t = await bootPapersApp()
    const real = t.ports.questionSource
    const filtered: BijakQuestionSource = {
      pool: (pool, scope) => real.pool(pool, scope),
      takenDownPins: () => Promise.resolve(takenDown),
      getMany: async (ids) => new Map([...(await real.getMany(ids))].filter(([id]) => !archived.has(id))),
    }
    ;(t.ports as unknown as { questions: BijakQuestionSource }).questions = filtered
    source = t.app.get(BijakPapersAttemptSource)
    student = await loginAs(t, 'pelajar@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const idOf = async (code: string): Promise<string> => (await t.db.query<{ id: string }>(`select id::text from papers where paper_code = $1 and kind = 'pilihan'`, [code]))[0]!.id
  const cover = async (id: string) => envelopeOf(BijakPaperCoverSchema).parse((await student.get(`/api/bijak/papers/${id}`)).body).data
  const firstPin = async (id: string) =>
    (await t.db.query<{ question_id: string; pinned_version_no: number }>(`select pl.question_id::text, pl.pinned_version_no from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 order by pl.id limit 1`, [id]))[0]!
  const refused = async (id: string) => {
    const r = await source.resolveForAttempt({ userId: student.userId, paperId: id, isTest: false })
    return r.ok ? null : r.reason
  }

  it('a paper every question of which is served: false, no reason, and a sitting is allowed', async () => {
    const id = await idOf('1449/2')
    const c = await cover(id)
    expect(c.unavailable).toBe(false)
    expect(c).not.toHaveProperty('unavailableReason')
    expect(await refused(id)).toBeNull()
  })

  it('a placed question archived in the bank: QUESTION_WITHDRAWN, same answer as the start', async () => {
    const id = await idOf('1449/2')
    const pin = await firstPin(id)
    archived.add(pin.question_id)
    try {
      expect(await cover(id)).toMatchObject({ unavailable: true, unavailableReason: 'QUESTION_WITHDRAWN' })
      expect(await refused(id)).toBe('not_eligible')
    } finally {
      archived.clear()
    }
  })

  it('a pinned version taken down while a later one is live: QUESTION_WITHDRAWN, same answer as the start', async () => {
    const id = await idOf('1449/2')
    const pin = await firstPin(id)
    takenDown.add(pinKey({ questionId: pin.question_id, versionNo: pin.pinned_version_no }))
    try {
      expect(await cover(id)).toMatchObject({ unavailable: true, unavailableReason: 'QUESTION_WITHDRAWN' })
      expect(await refused(id)).toBe('not_eligible')
    } finally {
      takenDown.clear()
    }
  })

  it('a paper that places no question (last: the test keeps it empty): NO_QUESTIONS, same answer as the start', async () => {
    const id = await idOf('4541/2')
    await t.db.query(`delete from paper_placements where paper_section_id in (select id from paper_sections where paper_id = $1)`, [id])
    expect(await cover(id)).toMatchObject({ unavailable: true, unavailableReason: 'NO_QUESTIONS' })
    expect(await refused(id)).toBe('not_eligible')
  })
})
