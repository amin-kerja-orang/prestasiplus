// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import KelasCreatePage from '../../pages/KelasCreatePage.vue'

// SW7-01 / DV-M10-40 / DV-M10-49: in http mode S5 offers only the teacher's own school.

const api = vi.hoisted(() => ({ createGuruClass: vi.fn() }))
vi.mock('../../api/guru', () => api)

const subjects = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../components/kelas/subjects', () => subjects)

const schools = vi.hoisted(() => ({ searchSchools: vi.fn() }))
vi.mock('@/modules/m02-users-schools', () => schools)

const session = vi.hoisted(() => ({ user: null as { schoolId: number | null } | null }))
vi.mock('@/stores/session', () => ({ useSessionStore: () => session }))

// The real API returns opaque string ids.
const OWN_SCHOOL = {
  id: '12',
  name: 'SMK DEMO TIGA',
  code: 'DEMO003',
  type: 'SMK',
  state: 'Johor',
  district: 'PPD SEGAMAT',
  city: null,
}

let router: Router
let wrapper: VueWrapper | undefined

async function mountPage() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/kelas', component: { template: '<div />' } },
      { path: '/guru/kelas/cipta', component: { template: '<div />' } },
    ],
  })
  await router.push('/guru/kelas/cipta')
  await router.isReady()
  wrapper = mount(KelasCreatePage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function fillAndSubmit(w: VueWrapper): Promise<void> {
  await w.get('[data-testid="kelas-name"]').setValue('5 Bestari')
  await w.get('[data-testid="kelas-subject"]').setValue('4')
  await w.findAll('[data-testid="kelas-levels"] [role="radio"]')[0]?.trigger('click')
  await w.get('[data-testid="kelas-form"]').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.stubEnv('VITE_API_MODE', 'http')
  session.user = { schoolId: 12 }
  subjects.fetchSubjectOptions.mockResolvedValue([{ id: 4, name: 'Sains' }])
  schools.searchSchools.mockResolvedValue([OWN_SCHOOL])
  api.createGuruClass.mockResolvedValue({ id: 1 })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllEnvs()
})

describe("S5 KelasCreatePage: the teacher's own school (DV-M10-40)", () => {
  it("preselects the teacher's school and sends its id when the picker is left untouched", async () => {
    const w = await mountPage()
    expect(schools.searchSchools).toHaveBeenCalledWith({ id: 12 })
    expect(w.get('[data-testid="school-selected-name"]').text()).toBe('SMK DEMO TIGA')
    expect(w.find('[data-testid="school-search"]').exists()).toBe(false)
    // SMK: only the Ting. tiles.
    expect(w.findAll('[data-testid="kelas-levels"] [role="radio"]')).toHaveLength(5)

    await w.findAll('[data-testid="kelas-levels"] [role="radio"]')[0]?.trigger('click')
    await w.get('[data-testid="kelas-name"]').setValue('5 Bestari')
    await w.get('[data-testid="kelas-subject"]').setValue('4')
    await w.get('[data-testid="kelas-form"]').trigger('submit')
    await flushPromises()
    expect(api.createGuruClass).toHaveBeenCalledTimes(1)
    expect(api.createGuruClass.mock.calls[0]?.[0]).toMatchObject({ schoolId: '12' })
  })

  it('does not submit while the school lookup is pending, then sends the school once it settles', async () => {
    let resolve!: (v: unknown) => void
    schools.searchSchools.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const w = await mountPage()
    expect(w.get('[data-testid="kelas-submit"]').attributes('disabled')).toBeDefined()
    await fillAndSubmit(w)
    expect(api.createGuruClass).not.toHaveBeenCalled()
    resolve([OWN_SCHOOL])
    await flushPromises()
    expect(w.get('[data-testid="kelas-submit"]').attributes('disabled')).toBeUndefined()
    await w.get('[data-testid="kelas-form"]').trigger('submit')
    await flushPromises()
    expect(api.createGuruClass).toHaveBeenCalledTimes(1)
    expect(api.createGuruClass.mock.calls[0]?.[0]).toMatchObject({ schoolId: '12' })
  })

  it('sends no schoolId and does not look a school up for a teacher without a school', async () => {
    session.user = { schoolId: null }
    const w = await mountPage()
    expect(schools.searchSchools).not.toHaveBeenCalled()
    expect(w.find('[data-testid="school-selected"]').exists()).toBe(false)
    await fillAndSubmit(w)
    expect(api.createGuruClass).toHaveBeenCalledTimes(1)
    expect(api.createGuruClass.mock.calls[0]?.[0]).not.toHaveProperty('schoolId')
  })

  it("offers only the teacher's own school: no search box and no clear button (DV-M10-49)", async () => {
    const w = await mountPage()
    expect(w.find('[data-testid="school-selected"]').exists()).toBe(true)
    expect(w.find('[data-testid="school-search"]').exists()).toBe(false)
    expect(w.find('[data-testid="school-results"]').exists()).toBe(false)
    expect(w.find('[data-testid="school-clear"]').exists()).toBe(false)
    // Only the lookup of the own school ran; no free-text school search.
    expect(schools.searchSchools).toHaveBeenCalledTimes(1)
    expect(schools.searchSchools).toHaveBeenCalledWith({ id: 12 })
  })

  it('shows no school picker and sends no schoolId when the own-school lookup returns nothing or fails', async () => {
    schools.searchSchools.mockResolvedValueOnce([])
    let w = await mountPage()
    expect(w.find('[data-testid="school-picker"]').exists()).toBe(false)
    expect(w.find('[data-testid="school-search"]').exists()).toBe(false)
    w.unmount()

    schools.searchSchools.mockRejectedValueOnce(new Error('boom'))
    w = await mountPage()
    expect(w.find('[data-testid="school-picker"]').exists()).toBe(false)
    await fillAndSubmit(w)
    expect(api.createGuruClass.mock.calls[0]?.[0]).not.toHaveProperty('schoolId')
  })

  it('keeps the live school search for a teacher without a school', async () => {
    session.user = { schoolId: null }
    const w = await mountPage()
    expect(w.find('[data-testid="school-search"]').exists()).toBe(true)
  })

  it('keeps the mock-mode start state: no lookup, empty picker, no schoolId', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    const w = await mountPage()
    expect(schools.searchSchools).not.toHaveBeenCalled()
    expect(w.find('[data-testid="school-selected"]').exists()).toBe(false)
    await fillAndSubmit(w)
    expect(api.createGuruClass.mock.calls[0]?.[0]).not.toHaveProperty('schoolId')
  })
})
