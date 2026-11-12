// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { DsAdminShell } from '@/ds'

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

async function mountShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
  })
  await router.push('/admin')
  const w = mount(DsAdminShell, {
    props: {
      groups: [],
      searchGroups: [],
      crumbs: [],
      title: 'Command Center',
      brandTo: '/admin',
      brandLabel: 'Pentadbiran',
      accountName: 'Admin Ujian',
      accountCaption: 'Admin Pusat',
      initials: 'AU',
      accountItems: [[{ label: 'Log keluar' }]],
      dark: false,
      themeLabel: 'Tukar tema',
    },
    global: { plugins: [router, createPinia()] },
    attachTo: document.body,
  })
  await router.isReady()
  return w
}

describe('DsAdminShell account avatar button', () => {
  it('is a focusable button with its name, title, testid and initials', async () => {
    const w = await mountShell()
    const btn = w.get('[data-testid="pentadbiran-account"]')
    expect(btn.element.tagName).toBe('BUTTON')
    expect(btn.attributes('type')).toBe('button')
    expect(btn.attributes('aria-label')).toBe('Menu akaun: Admin Ujian')
    expect(btn.attributes('title')).toBe('Admin Ujian')
    expect(btn.attributes('tabindex')).not.toBe('-1')
    expect(btn.text()).toBe('AU')
    ;(btn.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(btn.element)
    w.unmount()
  })

  it('opens the account menu with the name, caption and items', async () => {
    const w = await mountShell()
    const btn = w.get('[data-testid="pentadbiran-account"]')
    expect(btn.attributes('aria-expanded')).toBe('false')
    await btn.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(btn.attributes('aria-expanded')).toBe('true')
    const head = document.body.querySelector('[data-testid="pentadbiran-account-head"]')
    expect(head?.textContent).toContain('Admin Ujian')
    expect(head?.textContent).toContain('Admin Pusat')
    expect(document.body.textContent).toContain('Log keluar')
    w.unmount()
  })
})
