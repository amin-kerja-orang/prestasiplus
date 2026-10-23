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

describe('UsersDirectoryAdapter.subjectIdOfCode', () => {
  it('maps a Bijak code to the curriculum row id (MAT to MATH) and an unknown code to null', async () => {
    const asked: string[] = []
    const curriculum = {
      subjectByCode: async (code: string) => {
        asked.push(code)
        return code === 'MATH' ? { id: 3n } : code === 'BM' ? { id: 1n } : null
      },
    }
    const adapter = new UsersDirectoryAdapter({} as never, {} as never, curriculum as never)
    expect(await adapter.subjectIdOfCode('MAT')).toBe('3')
    expect(await adapter.subjectIdOfCode('BM')).toBe('1')
    expect(await adapter.subjectIdOfCode('ZZZ')).toBeNull()
    expect(asked).toEqual(['MATH', 'BM', 'ZZZ'])
  })
})
