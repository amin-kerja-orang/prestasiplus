import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { InMemoryStorage } from '../../src/modules/files/memory.storage'
import { SCAN_MESSAGES, ScanningFileStorage } from '../../src/modules/files/scanning-file-storage'
import { EICAR, StubScanner } from './scan-stub'

const KEY = 'avatar/0b6c1c4e-1111-4222-8333-444455556666.png'

function fieldsOf(err: unknown): Record<string, string> | undefined {
  expect(err).toBeInstanceOf(ApiError)
  return (err as ApiError).fields
}

describe('ScanningFileStorage', () => {
  it('writes a clean file and delegates get, exists and delete', async () => {
    const inner = new InMemoryStorage()
    const s = new ScanningFileStorage(inner, new StubScanner())
    await s.put(KEY, Buffer.from('fine'))
    expect(await s.exists(KEY)).toBe(true)
    expect((await s.get(KEY))?.toString()).toBe('fine')
    await s.delete(KEY)
    expect(await inner.exists(KEY)).toBe(false)
  })

  it('an infected file is not written and is refused with a 422 fields.file', async () => {
    const inner = new InMemoryStorage()
    const s = new ScanningFileStorage(inner, new StubScanner())
    const err = await s.put(KEY, Buffer.from(`a${EICAR}`)).catch((e: unknown) => e)
    expect(fieldsOf(err)).toEqual({ file: SCAN_MESSAGES.infected })
    expect((err as ApiError).getStatus()).toBe(422)
    expect(await inner.exists(KEY)).toBe(false)
  })

  it('an unavailable scanner writes nothing and is refused with the unavailable 422', async () => {
    const inner = new InMemoryStorage()
    const stub = new StubScanner()
    stub.down = true
    const err = await new ScanningFileStorage(inner, stub).put(KEY, Buffer.from('fine')).catch((e: unknown) => e)
    expect(fieldsOf(err)).toEqual({ file: SCAN_MESSAGES.unavailable })
    expect((err as ApiError).getStatus()).toBe(422)
    expect(await inner.exists(KEY)).toBe(false)
  })
})
