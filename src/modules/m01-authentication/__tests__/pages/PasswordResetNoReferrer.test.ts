// @vitest-environment jsdom
// SW8-07b: a reset form sends no Referer while it is open (<meta name="referrer">), because an SPA
// reached by client-side navigation keeps the policy of its first document load.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import PasswordResetEntryPage from '../../pages/PasswordResetEntryPage.vue'
import PasswordResetPage from '../../pages/PasswordResetPage.vue'

vi.mock('../../api', () => ({
  sendPasswordResetLink: vi.fn(),
  resetPassword: vi.fn(),
  resetByIc: vi.fn(),
}))

let wrapper: VueWrapper | null = null

async function open(path: string): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/password/reset', component: PasswordResetEntryPage },
      { path: '/password/reset/:token', component: PasswordResetPage },
    ],
  })
  await router.push(path)
  wrapper = mount(RouterView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const metas = () => document.head.querySelectorAll<HTMLMetaElement>('meta[name="referrer"]')

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  metas().forEach((m) => m.remove())
})

describe('useNoReferrer on the reset form (SW8-07b)', () => {
  it('is present while mounted and removed after unmount: fragment link', async () => {
    const w = await open('/password/reset#token=abc123')
    expect(metas()).toHaveLength(1)
    expect(metas()[0]?.content).toBe('no-referrer')
    w.unmount()
    wrapper = null
    expect(metas()).toHaveLength(0)
  })

  it('is present while mounted and removed after unmount: path route', async () => {
    const w = await open('/password/reset/path-token')
    expect(metas()).toHaveLength(1)
    expect(metas()[0]?.content).toBe('no-referrer')
    w.unmount()
    wrapper = null
    expect(metas()).toHaveLength(0)
  })

  it('adds nothing on the forgot-password page', async () => {
    await open('/password/reset')
    expect(metas()).toHaveLength(0)
  })

  it('restores a referrer meta that was there before', async () => {
    const existing = document.createElement('meta')
    existing.name = 'referrer'
    existing.content = 'strict-origin-when-cross-origin'
    document.head.appendChild(existing)
    const w = await open('/password/reset/path-token')
    expect(metas()).toHaveLength(1)
    expect(existing.content).toBe('no-referrer')
    w.unmount()
    wrapper = null
    expect(metas()).toHaveLength(1)
    expect(existing.content).toBe('strict-origin-when-cross-origin')
  })
})
