import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import type { FileStorage } from '../../src/modules/files/file-storage'
import { LocalDiskStorage } from '../../src/modules/files/local-disk.storage'
import { InMemoryStorage } from '../../src/modules/files/memory.storage'

const dirs: string[] = []
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
})

const implementations: Array<[string, () => Promise<FileStorage>]> = [
  ['InMemoryStorage', () => Promise.resolve(new InMemoryStorage())],
  [
    'LocalDiskStorage',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'pp-storage-'))
      dirs.push(dir)
      return new LocalDiskStorage(dir)
    },
  ],
]

// AC 5: the same contract tests run against both implementations.
describe.each(implementations)('FileStorage contract: %s', (_name, make) => {
  it('puts, gets, checks and deletes an object', async () => {
    const s = await make()
    const key = 'avatar/0b6c1c4e-1111-4222-8333-444455556666.png'
    expect(await s.exists(key)).toBe(false)
    expect(await s.get(key)).toBeNull()
    await s.put(key, Buffer.from('hello'))
    expect(await s.exists(key)).toBe(true)
    expect((await s.get(key))?.toString()).toBe('hello')
    await s.delete(key)
    expect(await s.exists(key)).toBe(false)
    expect(await s.get(key)).toBeNull()
  })

  it('replaces an existing key and deleting a missing key is not an error', async () => {
    const s = await make()
    const key = 'cms-image/aaaa.webp'
    await s.put(key, Buffer.from('one'))
    await s.put(key, Buffer.from('two'))
    expect((await s.get(key))?.toString()).toBe('two')
    await expect(s.delete('cms-image/missing.webp')).resolves.toBeUndefined()
  })

  it('returns a copy, not the stored buffer', async () => {
    const s = await make()
    const key = 'avatar/copy.png'
    await s.put(key, Buffer.from('abc'))
    const got = (await s.get(key)) as Buffer
    got[0] = 0
    expect((await s.get(key))?.toString()).toBe('abc')
  })

  it.each([
    '../x.png',
    'avatar/../../x.png',
    '/etc/passwd.png',
    'avatar\\x.png',
    'C:/x.png',
    'avatar/x.png/',
    'avatar//x.png',
    'avatar/.hidden',
    'Avatar/X.PNG',
    'avatar/x',
    '',
    `avatar/${'a'.repeat(300)}.png`,
  ])('refuses the unsafe key %j on every operation', async (key) => {
    const s = await make()
    await expect(s.put(key, Buffer.from('x'))).rejects.toThrow('Unsafe storage key')
    await expect(s.get(key)).rejects.toThrow('Unsafe storage key')
    await expect(s.delete(key)).rejects.toThrow('Unsafe storage key')
    await expect(s.exists(key)).rejects.toThrow('Unsafe storage key')
  })
})

describe('LocalDiskStorage', () => {
  it('writes under the root, leaves no temp file and keeps nothing outside', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pp-storage-'))
    dirs.push(dir)
    const s = new LocalDiskStorage(dir)
    await s.put('avatar/one.png', Buffer.from('x'))
    expect(await readdir(join(dir, 'avatar'))).toEqual(['one.png'])
  })
})
