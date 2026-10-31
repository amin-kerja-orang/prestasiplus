import { QuestionLeafPartSchema, type QuestionPart } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { CLOCK } from '../../src/db/clock'
import { gradeLeaf, PkskQuestionsService, QuestionsService } from '../../src/modules/questions'

/**
 * BE-42 / BE-09: the PKSK choice leaf (no database). The old MCQ leaf and the Bijak gate are unchanged, the PKSK leaf is
 * refused on the general routes (no `pksk` tag) and the PKSK service maps the wire statuses to the v2 lifecycle.
 */

const rich = (ms: string) => ({ ms })
const opts = (n: number) => 'ABCDEFGH'.slice(0, n).split('').map((label) => ({ label, body: rich(`Pilihan ${label}`) }))
const pksk = (n: number, correct: string[]) => ({ label: '1', prompt: rich('Soalan'), marks: 1, mode: 'pksk_choice', options: opts(n), key: { kind: 'options', correct } })
const mcq = (n: number, correct: string) => ({ label: '1', prompt: rich('Soalan'), marks: 1, mode: 'mcq', options: opts(n), key: { kind: 'option', correct } })

describe('contract: the PKSK leaf is additive', () => {
  it('McqLeaf is unchanged: 3 to 8 options, exactly one correct label, kind option only', () => {
    expect(QuestionLeafPartSchema.safeParse(mcq(4, 'B')).success).toBe(true)
    expect(QuestionLeafPartSchema.safeParse(mcq(2, 'A')).success).toBe(false)
    expect(QuestionLeafPartSchema.safeParse(mcq(4, 'H')).success).toBe(false)
    expect(QuestionLeafPartSchema.safeParse({ ...mcq(4, 'A'), key: { kind: 'options', correct: ['A'] } }).success).toBe(false)
  })

  it('accepts 2 to 6 options with any number of correct labels, and 0 options for an essay', () => {
    for (const leaf of [pksk(2, ['A']), pksk(4, ['A', 'C']), pksk(6, []), pksk(3, ['A', 'B', 'C']), pksk(0, [])]) {
      expect(QuestionLeafPartSchema.safeParse(leaf).success, JSON.stringify(leaf)).toBe(true)
    }
  })

  it('refuses 1 or 7 options, a duplicate label, a correct label that is not an option, and a one-label key', () => {
    const dup = { ...pksk(2, ['A']), options: [{ label: 'A', body: rich('x') }, { label: 'A', body: rich('y') }] }
    for (const leaf of [pksk(1, ['A']), pksk(7, ['A']), dup, pksk(3, ['D']), pksk(0, ['A']), { ...pksk(3, []), key: { kind: 'option', correct: 'A' } }]) {
      expect(QuestionLeafPartSchema.safeParse(leaf).success, JSON.stringify(leaf)).toBe(false)
    }
  })
})

describe('grading', () => {
  const leaf = (n: number, correct: string[]) => QuestionLeafPartSchema.parse(pksk(n, correct)) as Extract<QuestionPart, { mode: 'pksk_choice' }>

  it('the chosen label must be one flagged; several or none flagged; an essay needs review', () => {
    const two = leaf(3, ['A', 'C'])
    expect(gradeLeaf(two, { kind: 'option', label: 'C' })).toMatchObject({ correct: true })
    expect(gradeLeaf(two, { kind: 'option', label: 'B' })).toMatchObject({ correct: false })
    expect(gradeLeaf(leaf(3, []), { kind: 'option', label: 'A' })).toMatchObject({ correct: false })
    expect(gradeLeaf(leaf(0, []), { kind: 'option', label: 'A' })).toMatchObject({ kind: 'needs_review' })
  })
})

describe('the general question routes refuse a PKSK leaf (422)', () => {
  it('create with a pksk_choice part and no pksk tag', async () => {
    const service = new QuestionsService({} as never, {} as never, {} as never, {} as never, {} as never, { now: () => new Date() } as never, {} as never)
    const input = { questionType: 'mcq', questionText: 'Soalan', subjectId: '1', educationLevelId: '1', parts: [pksk(3, ['A'])] } as never
    await expect(service.create(input, { userId: '1', role: 'admin' })).rejects.toMatchObject({ status: 422, code: 'VALIDATION_ERROR' })
    void CLOCK
  })
})

/** In-memory repository for the PKSK service (records the calls; no database). */
function fakeRepo() {
  const calls: { name: string; args: unknown[] }[] = []
  const rec = (name: string, ...args: unknown[]) => calls.push({ name, args })
  const store = new Map<string, { status: string; live: number | null; version: Record<string, unknown>; pksk: { domainCode: string; level: 'T1' | 'T4' } }>()
  let next = 1
  const toRecord = (id: string) => {
    const r = store.get(id)
    if (!r) return null
    return {
      id,
      isActive: true,
      latestVersionNo: 1,
      liveVersionNo: r.live,
      pksk: r.pksk,
      version: { ...r.version, status: r.status, versionNo: 1, publishedAt: null },
    }
  }
  const repo = {
    create: (input: { pksk: { domainCode: string; level: 'T1' | 'T4' }; version: { status: string; parts: unknown[] } & Record<string, unknown> }) => {
      rec('create', input)
      const id = String(next++)
      const parts = (input.version.parts as { options: { label: string; bodyMs: string }[]; key: { content: { correct: string[] } } }[])[0]
      store.set(id, {
        status: input.version.status,
        live: input.version.status === 'approved' ? 1 : null,
        pksk: input.pksk,
        version: {
          stemMs: input.version.stemMs,
          explanationMs: input.version.explanationMs,
          difficultyTp: input.version.difficultyTp,
          parts: [
            {
              mode: 'pksk_choice',
              options: parts?.options.map((o) => ({ label: o.label, body: { ms: o.bodyMs } })),
              key: { kind: 'options', correct: parts?.key.content.correct },
            },
          ],
        },
      })
      return Promise.resolve(id)
    },
    getMany: (ids: string[], view: string, scope: string) => {
      rec('getMany', ids, view, scope)
      return Promise.resolve(ids.flatMap((i) => (store.has(i) && scope === 'only' ? [toRecord(i)] : [])))
    },
    lock: (id: string) => Promise.resolve(store.has(id)),
    rewriteVersion: (id: string, _no: number, draft: { status: string; stemMs: string }) => {
      rec('rewriteVersion', id, draft)
      const r = store.get(id)
      if (r) r.version = { ...r.version, stemMs: draft.stemMs }
      return Promise.resolve()
    },
    setPkskTags: (id: string, domainCode: string, level: 'T1' | 'T4') => {
      const r = store.get(id)
      if (r) r.pksk = { domainCode, level }
      return Promise.resolve(true)
    },
    setVersionStatus: (id: string, _no: number, status: string, extra: unknown) => {
      rec('setVersionStatus', id, status, extra)
      const r = store.get(id)
      if (r) r.status = status
      return Promise.resolve()
    },
    setLiveVersion: (id: string, no: number | null) => {
      rec('setLiveVersion', id, no)
      const r = store.get(id)
      if (r) r.live = no
      return Promise.resolve()
    },
    pkskIds: (ids: string[]) => Promise.resolve(ids.filter((i) => store.has(i))),
    removePksk: (ids: string[]) => Promise.resolve(ids.filter((i) => store.delete(i)).length),
  }
  return { repo, calls, store }
}

describe('PkskQuestionsService (BE-09 adapter over the one bank)', () => {
  const build = () => {
    const f = fakeRepo()
    const prisma = { transaction: <T>(fn: () => Promise<T>) => fn() }
    const service = new PkskQuestionsService(f.repo as never, prisma as never, { now: () => new Date('2026-10-21T04:00:00Z') })
    return { ...f, service }
  }
  const input = (over: Record<string, unknown> = {}) => ({
    domainCode: 'PKSK_MATH',
    targetLevel: 'T1' as const,
    status: 'approved' as const,
    questionText: 'Berapa 1+1?',
    difficultyLevel: 3,
    explanation: null,
    options: [{ text: '1', isCorrect: false }, { text: '2', isCorrect: true }, { text: '3', isCorrect: true }],
    ...over,
  })

  it('create tags the question, stores one pksk_choice leaf with no curriculum tag, and approved is published (live)', async () => {
    const { service, calls } = build()
    const created = await service.create(input(), '7')
    expect(created).toMatchObject({ status: 'approved', questionText: 'Berapa 1+1?', difficultyLevel: 3 })
    expect(created.options.map((o) => o.isCorrect)).toEqual([false, true, true])
    const sent = calls.find((c) => c.name === 'create')?.args[0] as { pksk: unknown; version: Record<string, unknown> }
    expect(sent.pksk).toEqual({ domainCode: 'PKSK_MATH', level: 'T1' })
    expect(sent.version).toMatchObject({ status: 'approved', type: 'mcq', subjectId: null, educationLevelId: null, unitNodeId: null, difficultyTp: 3, spNodeIds: [] })
    expect((sent.version.parts as { mode: string; key: { kind: string } }[])[0]).toMatchObject({ mode: 'pksk_choice', key: { kind: 'options' } })
  })

  it('a bad option set is a 422 and nothing is created', async () => {
    const { service, calls } = build()
    await expect(service.create(input({ options: [{ text: 'solo', isCorrect: true }] }), '7')).rejects.toMatchObject({ status: 422 })
    expect(calls.some((c) => c.name === 'create')).toBe(false)
  })

  it('status mapping: pending is review (not live), approved is published (live), rejected is archived (withdrawn, not live)', async () => {
    const { service, calls } = build()
    const id = (await service.create(input(), '7')).id
    expect((await service.update(id, input({ status: 'pending' })))?.status).toBe('pending')
    expect(calls.filter((c) => c.name === 'setVersionStatus').at(-1)?.args.slice(1)).toEqual(['review', {}])
    expect(calls.filter((c) => c.name === 'setLiveVersion').at(-1)?.args[1]).toBeNull()
    expect((await service.update(id, input({ status: 'rejected' })))?.status).toBe('rejected')
    expect(calls.filter((c) => c.name === 'setVersionStatus').at(-1)?.args.slice(1)).toEqual(['archived', { archiveReason: 'withdrawn' }])
    expect(calls.filter((c) => c.name === 'setLiveVersion').at(-1)?.args[1]).toBeNull()
    // reset to pending is review again, then approve goes live again
    expect((await service.update(id, input({ status: 'pending' })))?.status).toBe('pending')
    expect((await service.update(id, input({ status: 'approved' })))?.status).toBe('approved')
    expect(calls.filter((c) => c.name === 'setLiveVersion').at(-1)?.args[1]).toBe(1)
  })

  it('only PKSK ids are touched: unknown or ordinary ids give null / 0 and nothing is written', async () => {
    const { service, calls } = build()
    expect(await service.update('99', input())).toBeNull()
    expect(await service.setStatus(['99'], 'approved')).toBe(0)
    expect(await service.remove(['99'])).toBe(0)
    expect(await service.get('99')).toBeNull()
    expect(calls.some((c) => c.name === 'rewriteVersion' || c.name === 'setVersionStatus')).toBe(false)
  })

  it('learner reads: the pool carries no correctness, answerKeys only for served questions of the level', async () => {
    const { service, repo, store } = build()
    const id = (await service.create(input(), '7')).id
    const served = { ...repo, pkskServedIds: () => Promise.resolve([id]), pkskServedCounts: () => Promise.resolve({ PKSK_MATH: 1 }) }
    const s2 = new PkskQuestionsService(served as never, { transaction: <T>(fn: () => Promise<T>) => fn() } as never, { now: () => new Date() })
    const pool = await s2.approvedPool('T1', ['PKSK_MATH'])
    expect(JSON.stringify(pool)).not.toMatch(/isCorrect|correct/)
    expect(pool[0]).toEqual({ id, domainCode: 'PKSK_MATH', questionText: 'Berapa 1+1?', options: [{ text: '1' }, { text: '2' }, { text: '3' }] })
    expect(await s2.answerKeys('T1', [id])).toEqual([{ id, domainCode: 'PKSK_MATH', optionCount: 3, correctIndexes: [1, 2] }])
    expect(await s2.answerKeys('T4', [id])).toEqual([])
    store.get(id)!.status = 'review'
    expect(await s2.answerKeys('T1', [id])).toEqual([])
  })
})
