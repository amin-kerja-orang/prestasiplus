// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { DsAdminShell, type DsShellNavGroup } from '@/ds'

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const groups: DsShellNavGroup[] = [
  {
    key: 'pintasan',
    rows: [
      {
        kind: 'link',
        id: 'PM-01',
        label: 'Command Center',
        icon: 'i-ph-broadcast',
        to: '/admin/command-center',
        active: false,
        badge: 'LIVE',
      },
      {
        kind: 'link',
        id: 'PM-02',
        label: 'Aktiviti Harian',
        icon: 'i-ph-calendar-check',
        to: '/admin/command-center/daily-activity',
        active: false,
      },
    ],
  },
  {
    key: 'analitik',
    label: 'Analitik',
    rows: [
      {
        kind: 'link',
        id: 'PM-03',
        label: 'Monitoring',
        icon: 'i-ph-monitor',
        to: '/admin/monitoring',
        active: false,
      },
    ],
  },
]

describe('DsAdminShell nav badge', () => {
  it('renders a pill next to the label of a link that has a badge, and only there', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
    })
    await router.push('/admin/command-center')
    const w = mount(DsAdminShell, {
      props: {
        groups,
        searchGroups: [],
        crumbs: [],
        title: 'Command Center',
        brandTo: '/admin',
        brandLabel: 'Pentadbiran',
        accountName: 'Admin',
        accountCaption: 'Admin Pusat',
        initials: 'A',
        accountItems: [],
        dark: false,
        themeLabel: 'Tukar tema',
      },
      global: { plugins: [router, createPinia()] },
      attachTo: document.body,
    })
    await router.isReady()
    const badges = w.findAll('[data-testid="pentadbiran-nav-badge"]')
    expect(badges).toHaveLength(1)
    expect(badges[0]?.text()).toBe('LIVE')
    expect(badges[0]?.element.closest('a')?.textContent).toContain('Command Center')
    // a group with no label renders no heading row; a labelled one does
    const navText = w.get('[data-testid="pentadbiran-nav"]').text()
    expect(navText).toContain('Analitik')
    expect(navText.indexOf('Analitik')).toBeGreaterThan(navText.indexOf('Aktiviti Harian'))
    expect(navText.trimStart().startsWith('Command Center')).toBe(true)
    w.unmount()
  })
})
