// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file -- a parent/child pair is the point of the provide/inject test */
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { provideNavBadges, useNavBadgeText } from '../user/nav-badges'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ api }))

function mountBadges() {
  let refresh: () => Promise<void> = () => Promise.resolve()
  const Child = defineComponent({
    setup() {
      const text = useNavBadgeText()
      return () => h('span', { id: 'b' }, text('gambar-rajah', '6,144'))
    },
  })
  const Parent = defineComponent({
    setup() {
      refresh = provideNavBadges().refresh
      return () => h(Child)
    },
  })
  const w = mount(Parent)
  return { w, refresh: () => refresh() }
}

describe('nav badges (M04 "Gambar Rajah" live count)', () => {
  it('shows the observed default before data and the live count after a refresh', async () => {
    api.get.mockResolvedValue({ meta: { unfilteredMcq: 6143 } })
    const { w, refresh } = mountBadges()
    expect(w.get('#b').text()).toBe('6,144')
    await refresh()
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith(
      '/api/diagram-audit',
      expect.objectContaining({ raw: true }),
    )
    expect(w.get('#b').text()).toBe('6,143')
  })

  it('keeps the default text when the call fails', async () => {
    api.get.mockRejectedValue(new Error('403'))
    const { w, refresh } = mountBadges()
    await refresh()
    await flushPromises()
    expect(w.get('#b').text()).toBe('6,144')
  })
})

describe('nav badges (no ticket count, ruling on #508)', () => {
  it('makes no open-count request', async () => {
    api.get.mockReset()
    api.get.mockResolvedValue({})
    let refresh: () => Promise<void> = () => Promise.resolve()
    const Parent = defineComponent({
      setup() {
        refresh = provideNavBadges().refresh
        return () => h('span')
      },
    })
    mount(Parent)
    await refresh()
    await flushPromises()
    expect(api.get.mock.calls.map((c) => c[0] as string)).not.toContain('/api/admin/tiket/open-count')
  })
})
