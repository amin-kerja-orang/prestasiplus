import { describe, expect, it } from 'vitest'

import { PAPERS_LIST_TTL_MS, PapersService } from '../../src/modules/bijak/papers'
import { BijakPapersPorts } from '../../src/modules/bijak/papers/ports'

/**
 * `listPapers` shares its pupil-independent half (published papers, subjects, question info, taken-down pins) between pupils:
 * reused for 60 s, one read in flight, stale-while-revalidate, and refreshed behind when a question event moves the generation.
 * DB-free: fake repository and ports count the bank reads.
 */
const at = new Date('2026-01-01T00:00:00Z')
const paper = (id: bigint) => ({
  id,
  kind: 'pilihan',
  status: 'published',
  surface: 'simulasi',
  title: 'Kertas',
  kertas: 1,
  year: 2024,
  paperCode: '1449/1',
  printedDurationMin: 60,
  totalMarks: null,
  examBoard: null,
  levelScope: null,
  subjectId: 1n,
  instructions: [],
  referenceSheets: [],
  generatedForUserId: null,
  publishedAt: at,
  createdAt: at,
  sections: [{ id: id * 10n, label: 'A', title: null, instruction: null, compulsory: true, markBudget: 2, ruleType: 'all', ruleN: null, placements: [{ questionId: 1n, pinnedVersionNo: 1, marksOverride: null, position: 1 }] }],
})

function build() {
  let nowMs = at.getTime()
  let generation = 0
  const published = [paper(7n)]
  const reads = { papers: 0, bank: 0, progress: 0 }
  let gate: Promise<void> | null = null
  const repo = {
    gradeOf: () => Promise.resolve(10),
    listPublishedPilihan: async () => {
      reads.papers += 1
      if (gate) await gate
      return [...published]
    },
    subjectsByIds: () => Promise.resolve(new Map([['1', { id: 1n, code: 'MATH', name: 'Matematik' }]])),
  }
  const ports = new BijakPapersPorts()
  ports.provideQuestionGeneration(() => generation)
  ports.provideQuestionSource({
    getMany: () => {
      reads.bank += 1
      return Promise.resolve(new Map([['1', 1]]))
    },
    takenDownPins: () => Promise.resolve(new Set<string>()),
    pool: () => Promise.resolve({ entries: [], groups: new Map() }),
  } as never)
  ports.provideProgress({
    progressFor: () => {
      reads.progress += 1
      return Promise.resolve(new Map())
    },
  } as never)
  const service = new PapersService(repo as never, ports, { now: () => new Date(nowMs) })
  return {
    service,
    reads,
    published,
    advance: (ms: number) => (nowMs += ms),
    bump: () => (generation += 1),
    hold: () => {
      let open!: () => void
      gate = new Promise<void>((r) => (open = r))
      return () => {
        gate = null
        open()
      }
    },
  }
}
const ids = async (t: ReturnType<typeof build>, user = '5') => (await t.service.listPapers(user)).map((p) => p.id)
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('listPapers shares the pupil-independent read', () => {
  it('two pupils within the TTL read the bank once; the progress read stays per pupil', async () => {
    const t = build()
    expect(await ids(t, '5')).toEqual(['7'])
    expect(await ids(t, '6')).toEqual(['7'])
    expect(t.reads).toEqual({ papers: 1, bank: expect.any(Number), progress: 2 })
    const bankReads = t.reads.bank
    await ids(t, '8')
    expect(t.reads.bank).toBe(bankReads)
  })

  it('concurrent cold readers share one flight', async () => {
    const t = build()
    const release = t.hold()
    const all = Promise.all([ids(t, '1'), ids(t, '2'), ids(t, '3')])
    await flush()
    release()
    await all
    expect(t.reads.papers).toBe(1)
  })

  it('past the TTL the old list is served at once and one refresh runs behind', async () => {
    const t = build()
    await ids(t)
    t.published.push(paper(8n))
    t.advance(PAPERS_LIST_TTL_MS + 1)
    const release = t.hold()
    expect(await ids(t, '6')).toEqual(['7'])
    expect(await ids(t, '7')).toEqual(['7'])
    release()
    await flush()
    await flush()
    expect(t.reads.papers).toBe(2)
    expect(await ids(t)).toEqual(['7', '8'])
  })

  it('a question event (generation moved) refreshes behind without blocking, inside the TTL', async () => {
    const t = build()
    await ids(t)
    t.published.push(paper(8n))
    t.bump()
    const release = t.hold()
    expect(await ids(t)).toEqual(['7'])
    release()
    await flush()
    await flush()
    expect(await ids(t)).toEqual(['7', '8'])
    expect(t.reads.papers).toBe(2)
  })

  it('a failed refresh keeps serving the old list', async () => {
    const t = build()
    await ids(t)
    t.advance(PAPERS_LIST_TTL_MS + 1)
    t.service['repo'].listPublishedPilihan = () => Promise.reject(new Error('db down'))
    expect(await ids(t)).toEqual(['7'])
    await flush()
    expect(await ids(t)).toEqual(['7'])
  })
})
