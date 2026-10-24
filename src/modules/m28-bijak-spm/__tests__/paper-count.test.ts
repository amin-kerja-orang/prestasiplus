// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { defineComponent, h } from 'vue'

import { useBijakPaperCount } from '../lib/use-paper-count'
import { setBijakServerForTests } from '../server/client'
import { BijakServer, MemoryStorage } from '../server/store'

afterEach(() => setBijakServerForTests(null))

describe('useBijakPaperCount', () => {
  it('is null while loading, then the number of papers the Bijak hub lists', async () => {
    const server = new BijakServer({ storage: new MemoryStorage(), latencyMs: 0 })
    setBijakServerForTests(server)
    const seen: Array<number | null> = []
    const C = defineComponent({
      setup() {
        const n = useBijakPaperCount()
        return () => {
          seen.push(n.value)
          return h('p', String(n.value))
        }
      },
    })
    const w = mount(C, { global: { plugins: [createPinia()] } })
    expect(seen[0]).toBeNull()
    await flushPromises()
    const expected = (await server.listPapers(0)).length
    expect(expected).toBeGreaterThan(0)
    expect(w.text()).toBe(String(expected))
  })
})
