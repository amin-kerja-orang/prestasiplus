import { describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../../src/db/prisma.service'
import type { ServabilityService } from '../../src/modules/questions/serving'
import { PaperServabilityService, REPORT_CHUNK } from '../../src/modules/questions/serving/paper-servability.service'

/**
 * REQ-A-018 (B3 pre-scan M2): the servability reads of the papers of a question go in chunks of `REPORT_CHUNK` (200) ids, as the lane reads do.
 * Worst case: 200 papers x ~40 questions = 8,000 distinct ids. A pure unit test with a fake prisma and a fake servability (no database).
 */
describe('PaperServabilityService.forQuestion: chunked servability reads', () => {
  const question = '10'
  const paperRows = (papers: number, perPaper: number) =>
    Array.from({ length: papers }, (_v, p) => ({
      id: BigInt(p + 1),
      title: `Kertas ${String(p)}`,
      status: 'published',
      kind: 'pilihan',
      sections: [{ placements: Array.from({ length: perPaper }, (_w, q) => ({ questionId: BigInt(1000 + p * perPaper + q) })) }],
    }))
  function build(papers: ReturnType<typeof paperRows>) {
    const prisma = { client: { paper: { count: vi.fn(async () => papers.length), findMany: vi.fn(async () => papers) } } } as unknown as PrismaService
    const reports = vi.fn(async (ids: readonly string[]) => new Map(ids.filter((id) => id !== 'none').map((id) => [id, { questionId: id, versionNo: 1, servedCount: 6, total: 6, activities: [{ activity: 'simulasi_paper', label: 'x', served: true, reasons: [] }] }])))
    const servability = { report: vi.fn(async () => ({ questionId: question })), reports } as unknown as ServabilityService
    return { service: new PaperServabilityService(prisma, servability), reports }
  }

  it('250 distinct ids go in two chunks (200 + 50), each id once, and every paper is answered', async () => {
    const { service, reports } = build(paperRows(5, 50))
    const out = await service.forQuestion(question)
    expect(out!.rows).toHaveLength(5)
    expect(out!.total).toBe(5)
    expect(reports.mock.calls.map((c) => c[0].length)).toEqual([REPORT_CHUNK, 50])
    const sent = reports.mock.calls.flatMap((c) => [...c[0]])
    expect(new Set(sent).size).toBe(250)
    expect(out!.rows.every((r) => r.served)).toBe(true)
  })

  it('the worst case, 200 papers of 40 questions (8,000 ids), is 40 bounded reads, not 200', async () => {
    const { service, reports } = build(paperRows(200, 40))
    await service.forQuestion(question)
    expect(reports).toHaveBeenCalledTimes(Math.ceil(8000 / REPORT_CHUNK))
    expect(Math.max(...reports.mock.calls.map((c) => c[0].length))).toBeLessThanOrEqual(REPORT_CHUNK)
  })

  it('200 ids or fewer is a single read', async () => {
    const { service, reports } = build(paperRows(4, 50))
    await service.forQuestion(question)
    expect(reports).toHaveBeenCalledTimes(1)
  })
})
