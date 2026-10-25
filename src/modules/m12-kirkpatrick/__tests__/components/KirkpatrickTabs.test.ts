// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { provideShellSectionTabs } from '@/ds'

import KirkpatrickTabs from '../../components/kirkpatrick/common/KirkpatrickTabs.vue'

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

async function open(shellTabs: boolean | null) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
  })
  await router.push('/admin/kirkpatrick/interventions')
  await router.isReady()
  const tabs = h(KirkpatrickTabs, { basePath: '/admin/kirkpatrick', current: 'interventions' })
  // A stand-in for the Pembelajaran / Pentadbiran layout: it provides the signal to the page below.
  const Layout = defineComponent({
    setup(_, { slots }) {
      if (shellTabs !== null) provideShellSectionTabs(ref(shellTabs))
      return () => slots.default?.()
    },
  })
  wrapper = mount(shellTabs === null ? { render: () => tabs } : Layout, {
    global: { plugins: [router] },
    ...(shellTabs === null ? {} : { slots: { default: () => tabs } }),
  })
  return wrapper
}

describe('KirkpatrickTabs (UAT G-16, A-PM11: one tab strip)', () => {
  it('shows its own six tabs outside a portal layout', async () => {
    const w = await open(null)
    expect(w.findAll('[data-testid="kirk-tabs"]')).toHaveLength(1)
    expect(w.findAll('[data-testid^="kirk-tab-"]')).toHaveLength(6)
  })

  it('shows its own tabs inside a layout that prints no section tabs', async () => {
    const w = await open(false)
    expect(w.findAll('[data-testid="kirk-tabs"]')).toHaveLength(1)
  })

  it('leaves its tabs out while the layout prints the section tabs', async () => {
    const w = await open(true)
    expect(w.find('[data-testid="kirk-tabs"]').exists()).toBe(false)
    expect(w.findAll('[data-testid^="kirk-tab-"]')).toHaveLength(0)
  })
})
