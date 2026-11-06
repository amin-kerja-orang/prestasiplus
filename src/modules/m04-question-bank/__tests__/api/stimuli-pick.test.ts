import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api', async (orig) => ({ ...(await orig<Record<string, unknown>>()), api: { get } }))

import { listStimuliToAttach } from '../../api/questions'

const s = (id: string, groupCount: number) => ({ id, kind: 'image', label: `S${id}`, excerpt: null, groupCount })

describe('listStimuliToAttach (Lampirkan rangsangan picker)', () => {
  beforeEach(() => get.mockReset())

  it('reads every page in order and lists the ungrouped stimulus of page 2', async () => {
    get.mockResolvedValueOnce({ data: [s('1', 1), s('2', 0)], meta: { totalPages: 2 } }).mockResolvedValueOnce({ data: [s('3', 0), s('4', 2)], meta: { totalPages: 2 } })
    const out = await listStimuliToAttach()
    expect(out.data.map((x) => x.id)).toEqual(['2', '3'])
    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls.map((c) => (c[1] as { query: { page: number } }).query.page)).toEqual([1, 2])
  })

  it('stops after the only page', async () => {
    get.mockResolvedValue({ data: [s('1', 0)], meta: { totalPages: 1 } })
    expect((await listStimuliToAttach()).data).toHaveLength(1)
    expect(get).toHaveBeenCalledTimes(1)
  })
})
