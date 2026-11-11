// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'

import { NOT_FOUND_TITLE, setRouteOutcome } from '@/app/router/outcome'

import { useShellTabTitle } from '../useShellTabTitle'

const Host = defineComponent({
  setup() {
    useShellTabTitle(ref('Command Center'))
    return () => h('div')
  },
})

async function mountAt(path: string, name: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', name, component: Host }],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(Host, { global: { plugins: [router] } })
  await w.vm.$nextTick()
  await new Promise((r) => setTimeout(r, 0))
  return w
}

afterEach(() => {
  setRouteOutcome(null)
  document.title = ''
})

describe('useShellTabTitle (C-43)', () => {
  it('prints the shell title on an ordinary page', async () => {
    await mountAt('/admin/command-center', 'x')
    expect(document.title).toBe('Command Center | PRESTASIPLUS')
  })

  it('the catch-all 404 inside the shell keeps the 404 tab title, not the shell title', async () => {
    await mountAt('/admin/command-center/school/abc', 'core.not-found')
    expect(document.title).toBe(NOT_FOUND_TITLE)
    expect(NOT_FOUND_TITLE).toBe('Halaman Tidak Dijumpai | PRESTASIPLUS')
  })

  it('an in-place 403 outcome keeps its own tab title', async () => {
    setRouteOutcome(403)
    await mountAt('/admin/command-center', 'x')
    expect(document.title).toBe('Akses Ditolak | PRESTASIPLUS')
  })
})
