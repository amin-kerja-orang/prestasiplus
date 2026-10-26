// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { UserMe } from '@/stores'
import UserDrawer from '../user/UserDrawer.vue'
import UserHeader from '../user/UserHeader.vue'
import UserSidebar from '../user/UserSidebar.vue'

const USER = {
  id: 8,
  name: 'Pentadbir Sekolah Demo',
  email: 'adminsekolah.demo.panjang@demo.test',
  role: 'school_admin',
} as unknown as UserMe

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
})
const global = { plugins: [router] }
const SUMMARY = { coins: 1, points: 2, streakDays: 3 }

beforeEach(() => setActivePinia(createPinia()))

describe('user shell readability (G5-M27 B3, B10, B11)', () => {
  it('B3: header title wraps to two lines below sm instead of truncating', () => {
    const w = mount(UserHeader, {
      props: {
        header: { title: 'Guru Menunggu Kelulusan', subtitle: 'Sub' },
        summary: SUMMARY,
        chips: 'full',
        user: USER,
        bellCount: 0,
      },
      global,
    })
    const cls = w.get('[data-testid="shell-user-title"]').classes()
    expect(cls).toContain('line-clamp-2')
    expect(cls).toContain('sm:line-clamp-1')
    expect(cls).toContain('break-words')
    expect(cls).not.toContain('truncate')
  })

  it('B10: no header/drawer text class under 12 px', () => {
    const header = mount(UserHeader, {
      props: {
        header: { title: 'T', subtitle: 'Sub' },
        summary: SUMMARY,
        chips: 'full',
        user: USER,
        bellCount: 5,
      },
      global,
    })
    const drawer = mount(UserDrawer, {
      props: { open: true, entries: [], currentPath: '/', user: USER },
      global,
    })
    for (const html of [header.html(), drawer.html()]) {
      expect(html).not.toMatch(/text-\[(?:8|9|10|11)px\]/)
    }
    expect(header.get('[data-testid="shell-user-subtitle"]').classes()).toContain('text-[12px]')
    expect(header.get('#notif-badge').classes()).toContain('text-[12px]')
    expect(header.get('[data-testid="shell-user-chips-strip"]').html()).not.toContain('text-[9px]')
    expect(drawer.get('[data-testid="shell-user-drawer-card"]').html()).toContain('text-[12px]')
  })

  it('B11: sidebar card wraps name and e-mail instead of cutting them', () => {
    const w = mount(UserSidebar, {
      props: { open: true, entries: [], currentPath: '/', user: USER },
      global,
    })
    const ps = w.get('[data-testid="shell-user-sidebar-card"]').findAll('p')
    expect(ps[0]!.text()).toBe(USER.name)
    expect(ps[0]!.classes()).toContain('break-words')
    expect(ps[0]!.classes()).not.toContain('truncate')
    expect(ps[1]!.text()).toBe(USER.email)
    expect(ps[1]!.classes()).toContain('break-all')
    expect(ps[1]!.classes()).not.toContain('truncate')
  })
})
