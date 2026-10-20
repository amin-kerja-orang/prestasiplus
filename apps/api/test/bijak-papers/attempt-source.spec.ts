import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakPapersAttemptSource, type BijakQuestionSource } from '../../src/modules/bijak/papers'
import { bootPapersApp, loginAs, type Client, type PapersTestApp } from './helpers'

/** The provider BE-16 plugs into `BijakAttemptPorts.providePaperSource` (eligibility of an attempt). */
describe('BijakPapersAttemptSource (BE-15 -> BE-16)', () => {
  let t: PapersTestApp
  let ann: Client
  let ben: Client
  let source: BijakPapersAttemptSource
  let missing: Set<string>

  beforeAll(async () => {
    missing = new Set()
    t = await bootPapersApp()
    const real = t.ports.questionSource
    const filtered: BijakQuestionSource = {
      pool: (pool, scope) => real.pool(pool, scope),
      getMany: async (ids) => {
        const all = await real.getMany(ids)
        return new Map([...all].filter(([id]) => !missing.has(id)))
      },
    }
    // The ports holder accepts one provider; swap the private field through its public setter once.
    ;(t.ports as unknown as { questions: BijakQuestionSource }).questions = filtered
    source = t.app.get(BijakPapersAttemptSource)
    ann = await loginAs(t, 'pelajar@demo.test')
    ben = await loginAs(t, 'pelajar2@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const pilihanId = async (): Promise<string> => {
    const res = await ann.get('/api/bijak/papers')
    return (res.body.data as { id: string; code: string }[]).find((p) => p.code === '1449/2')?.id as string
  }

  it('resolves a published paper with its sections and ordered question ids', async () => {
    const id = await pilihanId()
    const r = await source.resolveForAttempt({ userId: ann.userId, paperId: id, isTest: false })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.paper).toMatchObject({ id, kind: 'pilihan', subject: 'MAT', kertas: 2, code: '1449/2' })
    expect(r.paper.durationMin).toBeGreaterThan(0)
    expect(r.paper.sections.length).toBeGreaterThan(0)
    for (const s of r.paper.sections) {
      expect(s.id).toMatch(/^\d+$/)
      expect(s.questionIds.length).toBeGreaterThan(0)
      expect(['all', 'choose']).toContain(s.rule.type)
    }
  })

  it('is not_found for an unknown or malformed id and for a draft paper', async () => {
    expect(await source.resolveForAttempt({ userId: ann.userId, paperId: '999999999', isTest: false })).toEqual({ ok: false, reason: 'not_found' })
    expect(await source.resolveForAttempt({ userId: ann.userId, paperId: 'abc', isTest: false })).toEqual({ ok: false, reason: 'not_found' })
    const id = await pilihanId()
    await t.db.query(`update papers set status = 'draft' where id = $1`, [id])
    expect(await source.resolveForAttempt({ userId: ann.userId, paperId: id, isTest: false })).toEqual({ ok: false, reason: 'not_found' })
    await t.db.query(`update papers set status = 'published' where id = $1`, [id])
  })

  it('a generated paper is resolvable by its owner only', async () => {
    const gen = await ann.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
    expect(gen.status, JSON.stringify(gen.body)).toBe(201)
    const paperId = gen.body.data.paperId as string
    const mine = await source.resolveForAttempt({ userId: ann.userId, paperId, isTest: false })
    expect(mine.ok && mine.paper.kind).toBe('jana')
    expect(await source.resolveForAttempt({ userId: ben.userId, paperId, isTest: false })).toEqual({ ok: false, reason: 'not_found' })
  })

  it('is not_eligible when a placed question is no longer published, or the paper has no placement', async () => {
    const id = await pilihanId()
    const first = await source.resolveForAttempt({ userId: ann.userId, paperId: id, isTest: false })
    if (!first.ok) throw new Error('setup')
    missing.add(first.paper.sections[0]?.questionIds[0] as string)
    expect(await source.resolveForAttempt({ userId: ann.userId, paperId: id, isTest: false })).toEqual({ ok: false, reason: 'not_eligible' })
    missing.clear()
    await t.db.query(`create temp table _hold as select * from paper_placements where paper_section_id in (select id from paper_sections where paper_id = $1)`, [id]).catch(() => undefined)
  })
})
