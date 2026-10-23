// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import ParentInviteAcceptPage from '../../pages/ParentInviteAcceptPage.vue'

// SW4-05: the page runs against the REAL `fetchInvitePreview` fed a contract-shaped http body
// (`student: {firstName, schoolName}`, D57f), so a regression in the wire mapping shows here.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<object>()), api }))
// m02 is NOT mocked: only `@/api` is faked, so the page goes through the real wire mapping.

let wrapper: VueWrapper | null = null
const t = (id: string) => wrapper!.get(`[data-testid=${id}]`)

async function render(): Promise<void> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  wrapper = mount(ParentInviteAcceptPage, {
    props: { token: 'a'.repeat(64) },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.get.mockReset()
  api.post.mockReset()
  api.get.mockResolvedValue({
    valid: true,
    student: { firstName: 'Ali', schoolName: 'SMK DEMO' },
    viewer: 'guest',
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('invite preview from the contract wire (firstName only)', () => {
  it('heading names the student, initials fill the avatar', async () => {
    await render()
    expect(t('invite-heading').text()).toBe('Anda dijemput untuk memantau kemajuan Ali')
    expect(t('invite-initials').text()).toBe('A')
    expect(t('invite-school').text()).toBe('SMK DEMO')
  })

  it('caption names the student with no double space', async () => {
    await render()
    const caption = t('invite-caption').text()
    expect(caption).toBe('Pautan jemputan ini dikongsi oleh Ali melalui PRESTASIPLUS.')
    expect(caption).not.toContain('oleh  melalui')
  })
})
