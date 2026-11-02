import { describe, expect, it, vi } from 'vitest'

import { QuestionBankBuilderSource } from '../../src/modules/exam/builder/question-bank.source'

/**
 * R1-T31 (B2 minor): the public file tokens of the pictures of all stimulus groups of one call come from ONE file lookup, not one per group
 * (`groups()` for the editor and `review()` for the admin preview). No DB: the Prisma client, the question repository and the builder
 * repository are stubs that count their calls.
 */
const GROUPS = 6

const stimulusRow = (n: number) => ({ id: BigInt(100 + n), kind: 'image', label: `Rajah ${String(n)}`, bodyMs: null, caption: null, altText: null, tableData: null, sourceCitation: null, assetFileId: BigInt(500 + n) })
const groupRow = (n: number) => ({
  id: BigInt(10 + n),
  stimuli: [{ position: 1, stimulus: stimulusRow(n) }],
  options: [],
  questions: [{ id: BigInt(1000 + n) }],
})

function makeSource() {
  const fileFindMany = vi.fn((args: { where: { id: { in: bigint[] } } }) => Promise.resolve(args.where.id.in.map((id) => ({ id, publicId: `tok${id.toString()}` }))))
  const groupFindMany = vi.fn(() => Promise.resolve(Array.from({ length: GROUPS }, (_, n) => groupRow(n))))
  const client = {
    stimulusGroup: { findMany: groupFindMany },
    file: { findMany: fileFindMany },
    // servableLatest: every member question is secondary-level and not PKSK
    $queryRaw: vi.fn(() => Promise.resolve(Array.from({ length: GROUPS }, (_, n) => ({ id: BigInt(1000 + n) })))),
  }
  const records = Array.from({ length: GROUPS }, (_, n) => ({
    id: String(1000 + n),
    groupId: String(10 + n),
    version: { subjectId: null, unitId: null, spIds: [], educationLevelId: null, formOrigin: null, difficultyTp: 1, stemMs: `Soalan ${String(n)}`, parts: [] },
  }))
  const questions = { getMany: vi.fn(() => Promise.resolve(records)) }
  const builder = { subjectsByIds: vi.fn(() => Promise.resolve(new Map())) }
  const source = new QuestionBankBuilderSource({ client } as never, questions as never, builder as never)
  return { source, fileFindMany }
}

describe('QuestionBankBuilderSource: one token lookup per call (no N+1 over groups)', () => {
  it('groups(): N groups with a picture each read the file tokens once, for all their stimuli', async () => {
    const { source, fileFindMany } = makeSource()
    const out = await source.groups(Array.from({ length: GROUPS }, (_, n) => String(10 + n)))
    expect(out.size).toBe(GROUPS)
    expect(fileFindMany).toHaveBeenCalledTimes(1)
    const asked = fileFindMany.mock.calls[0]![0].where.id.in.map(String).sort()
    expect(asked).toEqual(Array.from({ length: GROUPS }, (_, n) => String(500 + n)).sort())
    // every group still gets its own picture URL
    for (let n = 0; n < GROUPS; n++) expect(out.get(String(10 + n))?.stimulus?.image?.url).toBe(`/api/files/tok${String(500 + n)}`)
  })

  it('review(): the same, for the stimuli of all groups of the preview', async () => {
    const { source, fileFindMany } = makeSource()
    const out = await source.review(Array.from({ length: GROUPS }, (_, n) => String(1000 + n)))
    expect(Object.keys(out.stimuli)).toHaveLength(GROUPS)
    expect(fileFindMany).toHaveBeenCalledTimes(1)
    for (let n = 0; n < GROUPS; n++) expect(out.stimuli[String(10 + n)]?.image?.url).toBe(`/api/files/tok${String(500 + n)}`)
  })

  it('a call without any picture reads no file at all', async () => {
    const { source, fileFindMany } = makeSource()
    expect((await source.groups([])).size).toBe(0)
    expect(fileFindMany).not.toHaveBeenCalled()
  })
})
