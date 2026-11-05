import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), blob: vi.fn() }))
vi.mock('@/api', () => ({ api: { list: h.list, get: h.get, blob: h.blob } }))

import {
  downloadSubmissionFile,
  fetchBatchFiles,
  fetchSubmissionCounts,
  fetchSubmissionItems,
} from '../../api/submissions'
import { submissionStatusOf } from '../../lib/submission-options'

beforeEach(() => {
  h.list.mockReset().mockResolvedValue({ data: [], meta: { totalItems: 0 } })
  h.get.mockReset()
  h.blob.mockReset()
})

describe('Kiriman Guru reads the intake items route (FR-ADM-Q12.1, FR-ADM-Q12.5)', () => {
  it('lists source=guru with the display key of the filter and the page', async () => {
    await fetchSubmissionItems({ status: 'Pending', page: 3 })
    expect(h.list).toHaveBeenCalledWith('/api/intake/items', {
      query: { source: 'guru', kirimanStatus: 'Pending', page: 3, pageSize: 20 },
    })
  })

  it('sends no status while unfiltered', async () => {
    await fetchSubmissionItems()
    expect(h.list).toHaveBeenCalledWith('/api/intake/items', {
      query: { source: 'guru', kirimanStatus: null, page: 1, pageSize: 20 },
    })
  })

  it('never calls the removed submissions route', async () => {
    await fetchSubmissionItems()
    await fetchSubmissionCounts()
    for (const [url] of h.list.mock.calls) expect(url).not.toContain('question-submissions')
  })

  it('reads each tile from the server total of its key', async () => {
    const totals: Record<string, number> = { Jumlah: 9, Pending: 4, Processing: 3, Selesai: 1 }
    h.list.mockImplementation((_url: string, o: { query: { kirimanStatus: string } }) =>
      Promise.resolve({ data: [], meta: { totalItems: totals[o.query.kirimanStatus] } }),
    )
    await expect(fetchSubmissionCounts()).resolves.toEqual({
      all: 9,
      pending: 4,
      processing: 3,
      done: 1,
    })
    expect(h.list).toHaveBeenCalledTimes(4)
  })

  it('reads each batch once and leaves out a batch that fails', async () => {
    const file = { id: '7', originalName: 'kertas.pdf' }
    h.get.mockImplementation((url: string) =>
      url.endsWith('/1') ? Promise.resolve({ files: [file] }) : Promise.reject(new Error('404')),
    )
    const files = await fetchBatchFiles(['1', '1', '2'])
    expect(h.get).toHaveBeenCalledTimes(2)
    expect(files.get('1')).toEqual([file])
    expect(files.has('2')).toBe(false)
  })

  it('downloads the original of a file', async () => {
    await downloadSubmissionFile('7')
    expect(h.blob).toHaveBeenCalledWith('/api/intake/files/7/original')
  })
})

describe('submissionStatusOf (40 OPT-KIRIMAN-STATUS)', () => {
  const question = (status: string) => ({ id: '1', version: 1, status })

  it.each(['generated', 'needs_review', 'duplicate'] as const)('%s is Pending', (state) => {
    expect(submissionStatusOf({ state, question: null })).toBe('Pending')
  })

  it('rejected is Ditolak', () => {
    expect(submissionStatusOf({ state: 'rejected', question: null })).toBe('Ditolak')
  })

  it('Terima moves a row to Processing, never to Selesai', () => {
    const row = { state: 'accepted', question: question('draft') } as Parameters<typeof submissionStatusOf>[0]
    expect(submissionStatusOf(row)).toBe('Processing')
  })

  it('only an approved question is Selesai', () => {
    const row = { state: 'accepted', question: question('approved') } as Parameters<typeof submissionStatusOf>[0]
    expect(submissionStatusOf(row)).toBe('Selesai')
  })
})
