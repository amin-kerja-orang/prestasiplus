// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { api, installTransport, type TransportResponse } from '@/api'

import { useServerStatus, type ServerStatus } from '../admin/server-status'

const reading = (cpuPct: number): ServerStatus => ({
  cpuPct,
  ramPct: 10,
  diskPct: 10,
  uptime: '1d 0h',
  load: 0,
  cores: 8,
  ramUsedGb: 1,
  ramTotalGb: 2,
})

afterEach(() => {
  vi.useRealTimers()
  api.configure({ transport: null })
})

describe('useServerStatus: stale responses', () => {
  it('drops a slower response that arrives after a newer one (seq guard)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const pending: ((r: TransportResponse) => void)[] = []
    installTransport({
      request() {
        return new Promise<TransportResponse>((resolve) => pending.push(resolve))
      },
    })
    let status: ReturnType<typeof useServerStatus>['status'] | null = null
    const w = mount(
      defineComponent({
        setup() {
          status = useServerStatus().status
          return () => h('div')
        },
      }),
    )
    const answer = (i: number, cpu: number) =>
      pending[i]!({ status: 200, headers: {}, body: { data: reading(cpu) } })

    // Request 0 (at start) is slow; request 1 (30 s later) answers first.
    await vi.advanceTimersByTimeAsync(30_000)
    expect(pending).toHaveLength(2)
    answer(1, 70)
    await flushPromises()
    expect(status!.value?.cpuPct).toBe(70)
    answer(0, 5)
    await flushPromises()
    expect(status!.value?.cpuPct).toBe(70)
    w.unmount()
  })
})
