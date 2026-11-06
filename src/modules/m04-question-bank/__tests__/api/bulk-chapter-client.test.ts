import { describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { TransportRequest } from '@/api'

import { bulkChapter, fetchChapterCoverage } from '../../api/studio'

const json = (body: unknown) => Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, body })

describe('bulk-chapter client', () => {
  it('posts the body as given and resolves to the result (no overwrite key)', async () => {
    const requests: TransportRequest[] = []
    const result = { matched: 2, eligible: 1, refused: 1, applied: 0, cap: 10000, remaining: 0, capped: false, dryRun: true, auditId: null }
    installTransport({ request: vi.fn((r: TransportRequest) => (requests.push(r), json({ data: result }))) })
    const res = await bulkChapter({ chapterId: '7', ids: ['1', '2'], dryRun: true })
    expect(res).toEqual(result)
    const sent = JSON.stringify(requests[0])
    expect(sent).toContain('/api/admin/curriculum/questions/bulk-chapter')
    expect(sent).not.toContain('overwrite')
  })

  it('reads the coverage rows', async () => {
    const requests: TransportRequest[] = []
    const row = { subjectId: '2', subjectName: 'Sains', levelCode: 'T5', approved: 5, withChapter: 2, withoutChapter: 3 }
    installTransport({ request: vi.fn((r: TransportRequest) => (requests.push(r), json({ data: { rows: [row] } }))) })
    expect(await fetchChapterCoverage({ subjectId: '2', educationLevelId: '11' })).toEqual([row])
    expect(JSON.stringify(requests[0])).toContain('/api/admin/curriculum/chapter-coverage')
  })
})
