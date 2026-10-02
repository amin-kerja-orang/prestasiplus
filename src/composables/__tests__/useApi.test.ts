import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { ApiError } from '@/api'

import { useApi } from '../useApi'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const scopes: ReturnType<typeof effectScope>[] = []
function inScope<T>(fn: () => T): T {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(fn) as T
}

afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
})

describe('useApi', () => {
  it('fetches on creation and exposes data and loading', async () => {
    const fetcher = vi.fn(() => Promise.resolve({ id: 1 }))
    const { data, loading, error } = inScope(() => useApi(fetcher))
    expect(loading.value).toBe(true)
    await vi.waitFor(() => expect(loading.value).toBe(false))
    expect(data.value).toEqual({ id: 1 })
    expect(error.value).toBeNull()
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('refetches when a dependency changes', async () => {
    const page = ref(1)
    const fetcher = vi.fn(() => Promise.resolve(`page ${page.value}`))
    const { data } = inScope(() => useApi(fetcher, () => page.value))
    await vi.waitFor(() => expect(data.value).toBe('page 1'))

    page.value = 2
    await nextTick()
    await vi.waitFor(() => expect(data.value).toBe('page 2'))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('aborts the previous fetch and never writes a stale result', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const signals: AbortSignal[] = []
    const queue = [first, second]
    const { data, reload } = inScope(() =>
      useApi((signal) => {
        signals.push(signal)
        return queue.shift()!.promise
      }),
    )
    const reloading = reload()
    expect(signals[0]?.aborted).toBe(true)

    second.resolve('fresh')
    await reloading
    first.resolve('stale')
    await Promise.resolve()
    expect(data.value).toBe('fresh')
  })

  it('stores the error and clears data on failure', async () => {
    let fail = false
    const { data, error, reload } = inScope(() =>
      useApi(() =>
        fail
          ? Promise.reject(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
          : Promise.resolve(5),
      ),
    )
    await vi.waitFor(() => expect(data.value).toBe(5))
    fail = true
    await reload()
    expect(data.value).toBeNull()
    expect(error.value).toBeInstanceOf(ApiError)
    expect((error.value as ApiError).status).toBe(404)
  })

  it('does not fetch with immediate: false, and aborts on scope dispose', () => {
    const signals: AbortSignal[] = []
    const fetcher = vi.fn((signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<number>(() => undefined)
    })
    const scope = effectScope()
    const api = scope.run(() => useApi(fetcher, undefined, { immediate: false }))!
    expect(fetcher).not.toHaveBeenCalled()
    void api.reload()
    scope.stop()
    expect(signals[0]?.aborted).toBe(true)
  })
})
