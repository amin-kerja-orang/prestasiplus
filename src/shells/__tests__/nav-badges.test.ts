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

describe('nav badges (M22 "Urus Tiket" open-ticket count)', () => {
  function mountTickets() {
    let refresh: () => Promise<void> = () => Promise.resolve()
    const Child = defineComponent({
      setup() {
        const text = useNavBadgeText()
        return () => h('span', { id: 't' }, text('urus-tiket', '2'))
      },
    })
    const Parent = defineComponent({
      setup() {
        refresh = provideNavBadges().refresh
        return () => h(Child)
      },
    })
    return { w: mount(Parent), refresh: () => refresh() }
  }

  it('shows the live open-ticket count after a refresh (0 is the text "0")', async () => {
    api.get.mockImplementation((url: string) =>
      Promise.resolve(url === '/api/admin/tiket/open-count' ? { count: 0 } : {}),
    )
    const { w, refresh } = mountTickets()
    expect(w.get('#t').text()).toBe('2')
    await refresh()
    await flushPromises()
    expect(w.get('#t').text()).toBe('0')
  })

  it('keeps the static "2" when the call fails', async () => {
    api.get.mockRejectedValue(new Error('403'))
    const { w, refresh } = mountTickets()
    await refresh()
    await flushPromises()
    expect(w.get('#t').text()).toBe('2')
  })
})
