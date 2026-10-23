// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import MasteryCard from '../../components/prestasi360/MasteryCard.vue'
import WeakTopicsCard from '../../components/prestasi360/WeakTopicsCard.vue'

/**
 * D6 (23 Oct sweep): a teacher reading a pupil's Prestasi 360 has no `/practice` in the prototype scope, so the
 * "Mula Berlatih" and "Fokus" buttons are hidden for them; the pelajar keeps them.
 */
const TOPIC = {
  spId: 5,
  label: 'Topik',
  code: 'SP 1.1',
  subjectCode: 'MATH',
  levelId: 5,
  attempts: 4,
  accuracy: 40,
  focusCount: 10,
}

async function mountAs(role: 'student' | 'teacher', component: object, props: object) {
  setActivePinia(createPinia())
  useSessionStore().setSession({
    token: 't',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: { id: 1, name: 'X', email: 'x@demo.test', role, schoolId: null, landingPath: '/' },
  } as unknown as Parameters<ReturnType<typeof useSessionStore>['setSession']>[0])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<i />' } }],
  })
  await router.push('/')
  return mount(component, { props, global: { plugins: [router] } })
}

beforeEach(() => {
  vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Prestasi 360 practice links follow the role scope', () => {
  it('pelajar keeps "Mula Berlatih" and "Fokus"', async () => {
    const m = await mountAs('student', MasteryCard, { mastery: [] })
    expect(m.find('[data-testid=mastery-start]').exists()).toBe(true)
    const w = await mountAs('student', WeakTopicsCard, { topics: [TOPIC] })
    expect(w.find('[data-testid=focus-link]').exists()).toBe(true)
  })

  it('teacher gets neither (no /practice in scope)', async () => {
    const m = await mountAs('teacher', MasteryCard, { mastery: [] })
    expect(m.find('[data-testid=mastery-empty]').exists()).toBe(true)
    expect(m.find('[data-testid=mastery-start]').exists()).toBe(false)
    const w = await mountAs('teacher', WeakTopicsCard, { topics: [TOPIC] })
    expect(w.find('[data-testid=weak-list]').exists()).toBe(true)
    expect(w.find('[data-testid=focus-link]').exists()).toBe(false)
  })
})
