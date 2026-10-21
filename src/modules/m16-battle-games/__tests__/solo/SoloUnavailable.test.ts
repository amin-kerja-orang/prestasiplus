// @vitest-environment jsdom
/** D58 interim: in http mode the 5 solo games show a notice; mock mode and the other routes are unchanged. */
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

const SOLO = [
  ['permainan-betul-salah', 'SoloBetulSalahPage'],
  ['permainan-cabaran-kilat', 'SoloCabaranKilatPage'],
  ['permainan-tembak-jawapan', 'SoloTembakJawapanPage'],
  ['permainan-susun-jawapan', 'SoloSusunJawapanPage'],
  ['permainan-kad-memori', 'SoloKadMemoriPage'],
] as const

async function loadRoutes(mode: string): Promise<RouteRecordRaw[]> {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', mode)
  return (await import('../../routes/solo')).default
}

async function resolve(routes: RouteRecordRaw[], name: string): Promise<{ route: RouteRecordRaw; comp: unknown }> {
  const route = routes.find((r) => r.name === name)!
  const comp = (await (route.component as () => Promise<{ default: unknown }>)()).default
  return { route, comp }
}

afterEach(() => vi.unstubAllEnvs())

describe('solo routes by API mode (D58)', () => {
  it('http mode: the 5 games resolve to the unavailable notice, other routes unchanged', async () => {
    const routes = await loadRoutes('http')
    const notice = (await import('../../components/solo/SoloUnavailable.vue')).default
    for (const [name] of SOLO) expect((await resolve(routes, name)).comp).toBe(notice)
    const others = [
      ['permainan-roda-nasib', 'RodaNasibPage'],
      ['permainan-jutawan', 'JutawanPage'],
      ['permainan-jutawan-main', 'JutawanMainPage'],
    ] as const
    for (const [name, file] of others) {
      const { comp } = await resolve(routes, name)
      expect(comp).not.toBe(notice)
      expect((comp as { __file?: string }).__file).toContain(`${file}.vue`)
    }
  })

  it('mock mode: the 5 games still resolve to their own pages', async () => {
    const routes = await loadRoutes('mock')
    const notice = (await import('../../components/solo/SoloUnavailable.vue')).default
    for (const [name, page] of SOLO) {
      const { comp } = await resolve(routes, name)
      expect(comp).not.toBe(notice)
      expect((comp as { __file?: string }).__file).toContain(`${page}.vue`)
    }
  })

  it.each(SOLO)('http mode: %s mounts the notice with exact copy and a back link', async (name) => {
    const routes = await loadRoutes('http')
    const { route, comp } = await resolve(routes, name)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { ...route, component: comp as never },
        { path: '/permainan', component: { template: '<div />' } },
      ] as RouteRecordRaw[],
    })
    await router.push(String(route.path))
    await router.isReady()
    const w = mount(comp as never, { global: { plugins: [router] } })
    await flushPromises()
    const box = w.get('[data-testid="solo-unavailable"]')
    expect(box.text()).toContain('Permainan ini belum tersedia dalam demo')
    expect(box.text()).toContain('Sila cuba permainan lain di halaman Permainan.')
    expect(w.get('a').attributes('href')).toBe('/permainan')
    const h1 = w.findAll('h1')
    if (name === 'permainan-kad-memori') {
      expect(h1).toHaveLength(1)
      expect(h1[0]?.text()).toBe('Kad Memori')
    } else {
      expect(h1).toHaveLength(0)
    }
  })
})
