import { describe, expect, it } from 'vitest'

import { USER_CHUNK, UsersDirectoryAdapter } from '../../../../src/modules/reports/performance/adapters/users-directory.adapter'

const record = (id: string) => ({ id, name: `Murid ${id}`, grade: null, schoolId: 's1', isActive: true, roles: ['student'] })

describe('UsersDirectoryAdapter.users', () => {
  it('reads users in chunks of USER_CHUNK ids, once per distinct id', async () => {
    const calls: string[][] = []
    const repo = {
      getMany: async (ids: string[]) => {
        calls.push([...ids])
        return ids.map(record)
      },
    }
    const adapter = new UsersDirectoryAdapter(repo as never, {} as never, {} as never)
    expect(USER_CHUNK).toBe(1000)
    adapter.chunk = 2
    const out = await adapter.users(['1', '2', '3', '4', '5', '3'])
    expect(calls).toEqual([['1', '2'], ['3', '4'], ['5']])
    expect([...out.keys()]).toEqual(['1', '2', '3', '4', '5'])
    expect(out.get('1')).toMatchObject({ isStudent: true, levelSlug: null })
  })

  it('an empty list makes no read', async () => {
    let n = 0
    const adapter = new UsersDirectoryAdapter({ getMany: async () => (n++, []) } as never, {} as never, {} as never)
    expect((await adapter.users([])).size).toBe(0)
    expect(n).toBe(0)
  })
})

describe('UsersDirectoryAdapter.subjectIdsOfCodes', () => {
  it('maps Bijak codes to the curriculum row ids (MAT to MATH) in one read; an unknown code is absent', async () => {
    let reads = 0
    const curriculum = {
      subjects: async () => (reads++, [{ id: 3n, code: 'MATH' }, { id: 1n, code: 'BM' }, { id: 7n, code: 'SCI' }]),
    }
    const adapter = new UsersDirectoryAdapter({} as never, {} as never, curriculum as never)
    const ids = await adapter.subjectIdsOfCodes(['MAT', 'BM', 'SN', 'ZZZ'])
    expect([...ids]).toEqual([['MAT', '3'], ['BM', '1'], ['SN', '7']])
    expect(reads).toBe(1)
  })

  it('an empty list makes no read', async () => {
    let reads = 0
    const adapter = new UsersDirectoryAdapter({} as never, {} as never, { subjects: async () => (reads++, []) } as never)
    expect((await adapter.subjectIdsOfCodes([])).size).toBe(0)
    expect(reads).toBe(0)
  })
})
