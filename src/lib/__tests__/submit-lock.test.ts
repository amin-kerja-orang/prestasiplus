// Double-submit guard (AC-ERR-5).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSubmitLock } from '../submit-lock'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function deferred() {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createSubmitLock', () => {
  it('sends one request for two presses within 200 ms and shows Menyimpan... until it settles', async () => {
    const d = deferred()
    const send = vi.fn(() => d.promise)
    const lock = createSubmitLock(send)
    const first = lock.run()
    vi.advanceTimersByTime(150)
    const second = lock.run()
    expect(send).toHaveBeenCalledTimes(1)
    expect(lock.pending.value).toBe(true)
    expect(lock.labelFor('Simpan')).toBe('Menyimpan...')
    d.resolve()
    await first
    expect(await second).toBeUndefined()
    expect(lock.pending.value).toBe(false)
    expect(lock.labelFor('Simpan')).toBe('Simpan')
  })

  it('still ignores a press inside 200 ms when the request settled instantly', async () => {
    const send = vi.fn(() => Promise.resolve())
    const lock = createSubmitLock(send)
    await lock.run()
    await lock.run()
    expect(send).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(200)
    await lock.run()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('ignores presses while a slow request runs, then releases on error and re-throws it', async () => {
    const d = deferred()
    const lock = createSubmitLock(() => d.promise)
    const first = lock.run()
    vi.advanceTimersByTime(5000)
    expect(await lock.run()).toBeUndefined()
    d.reject(new Error('gagal'))
    await expect(first).rejects.toThrow('gagal')
    expect(lock.pending.value).toBe(false)
  })

  it('passes arguments and result through', async () => {
    const lock = createSubmitLock((n: number) => Promise.resolve(n * 2))
    expect(await lock.run(4)).toBe(8)
  })
})
