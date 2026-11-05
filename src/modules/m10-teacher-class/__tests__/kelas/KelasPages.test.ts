// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { GuruClass } from '../../api/types'
import KelasListPage from '../../pages/KelasListPage.vue'

const api = vi.hoisted(() => ({
  fetchGuruClasses: vi.fn(),
  fetchGuruStudents: vi.fn(),
}))
vi.mock('../../api/guru', () => api)

const subjects = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../components/kelas/subjects', () => subjects)

function cls(id: number, extra: Partial<GuruClass> = {}): GuruClass {
  return {
    id,
    kind: 'classroom',
    teacherId: 5,
    schoolId: 1,
    name: `Kelas ${String(id)}`,
    subjectId: 4,
    subjectName: 'Sains',
    educationLevel: 'tingkatan-5',
    levelId: 11,
    levelLabel: 'Ting. 5',
    academicYear: 2026,
    description: null,
    joinCode: `DMO${String(id).slice(-3)}`,
    isActive: true,
    createdAt: '2026-09-01T08:00:00+08:00',
    studentCount: 8,
    ...extra,
  }
}

const list = (rows: GuruClass[]) => ({ data: rows, meta: {} })

let router: Router
let wrapper: VueWrapper | undefined

async function mountPage(component: Component) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/kelas', component: { template: '<div id="list" />' } },
      { path: '/guru/kelas/cipta', component: { template: '<div />' } },
    ],
  })
  await router.push('/guru/kelas')
  await router.isReady()
  wrapper = mount(component, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.fetchGuruStudents.mockResolvedValue({ data: [], meta: { count: 0, schoolSet: true } })
  subjects.fetchSubjectOptions.mockResolvedValue([
    { id: 1, name: 'Bahasa Melayu' },
    { id: 4, name: 'Sains' },
  ])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('R1-GUR-8 KelasListPage', () => {
  it('shows "0 kelas · 0 pelajar", "Cipta Kelas" and the PRD empty state with no class', async () => {
    api.fetchGuruClasses.mockResolvedValue(list([]))
    const w = await mountPage(KelasListPage)
    expect(w.get('h1').text()).toBe('Kelas Saya')
    expect(w.get('[data-testid="kelas-active-count"]').text()).toBe('0 kelas · 0 pelajar')
    expect(w.get('[data-testid="kelas-create"]').attributes('href')).toBe('/guru/kelas/cipta')
    expect(w.get('[data-testid="kelas-create"]').text()).toBe('Cipta Kelas')
    const empty = w.get('[data-testid="kelas-empty"]')
    expect(empty.text()).toContain('Belum ada kelas. Cipta kelas pertama anda untuk mula.')
    expect(w.get('[data-testid="kelas-empty-create"]').attributes('href')).toBe('/guru/kelas/cipta')
    expect(w.get('[data-testid="kelas-empty-create"]').text()).toBe('Cipta Kelas')
  })

  it('counts each pupil once, even a pupil who is in two classes (distinct pupils)', async () => {
    api.fetchGuruClasses.mockResolvedValue(list([cls(2001), cls(2002)]))
    api.fetchGuruStudents.mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      meta: { count: 3, schoolSet: true },
    })
    const w = await mountPage(KelasListPage)
    // Two classes of 8 each, but 3 distinct pupils in the roster.
    expect(w.get('[data-testid="kelas-active-count"]').text()).toBe('2 kelas · 3 pelajar')
  })

  it('the card "pelajar" counts equal the class studentCount; the cards show no join code', async () => {
    api.fetchGuruClasses.mockResolvedValue(list([cls(2001, { studentCount: 3 })]))
    const w = await mountPage(KelasListPage)
    expect(w.get('[data-testid="class-count"]').text()).toBe('3 pelajar')
  })

  it('R1-GUR-8: a class card has an Edit link and no join code or QR button', async () => {
    api.fetchGuruClasses.mockResolvedValue(list([cls(2001)]))
    const w = await mountPage(KelasListPage)
    const card = w.get('[data-testid="class-card"]')
    expect(card.get('[data-testid="class-edit"]').attributes('href')).toBe('/guru/kelas/2001/edit')
    expect(card.get('[data-testid="class-edit"]').text()).toBe('Edit')
    expect(card.find('[data-testid="class-code"]').exists()).toBe(false)
    expect(card.find('[data-testid="class-qr"]').exists()).toBe(false)
    expect(card.text()).not.toContain('DMO001')
  })

  it('lists and counts only the active classes', async () => {
    api.fetchGuruClasses.mockResolvedValue(
      list([cls(2001), cls(2002, { subjectName: null }), cls(2003, { isActive: false })]),
    )
    const w = await mountPage(KelasListPage)
    expect(w.get('[data-testid="kelas-active-count"]').text()).toBe('2 kelas · 0 pelajar')
    const cards = w.findAll('[data-testid="class-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.text()).toContain('8 pelajar')
    expect(cards[0]?.text()).toContain('Ting. 5')
    expect(cards[1]?.get('[data-testid="class-subject"]').text()).toBe('Tiada Subjek')
  })

  it('shows an error box when the list fails', async () => {
    api.fetchGuruClasses.mockRejectedValue(new Error('boom'))
    const w = await mountPage(KelasListPage)
    expect(w.text()).toContain('Gagal memuatkan senarai kelas')
  })
})
