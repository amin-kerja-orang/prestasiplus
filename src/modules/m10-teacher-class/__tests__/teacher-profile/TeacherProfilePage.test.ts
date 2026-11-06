// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { api, ApiError } from '@/api'

import TeacherProfilePage from '../../pages/TeacherProfilePage.vue'

/** S5-T05 part C: `/guru/profil/:id` read-only teacher card (R1-GUR-A1 FR-GUR-A1-4, AC-GUR-A1-2). */
const CARD = { name: 'Guru Lain', subject: 'Sains', bio: 'Saya suka mengajar.', qualification: 'Ijazah Sarjana Muda', experienceYears: 12 }

let wrapper: VueWrapper | null = null
let getSpy: MockInstance<typeof api.get>

async function render(result: object | Error, id = '9'): Promise<VueWrapper> {
  getSpy = vi.spyOn(api, 'get')
  if (result instanceof Error) getSpy.mockRejectedValue(result)
  else getSpy.mockResolvedValue(result)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/guru/profil/:id', component: TeacherProfilePage }] })
  await router.push(`/guru/profil/${id}`)
  wrapper = mount(TeacherProfilePage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('TeacherProfilePage', () => {
  it('shows name, Tentang (Bio), Subjek Utama, Kelayakan and Pengalaman from the teacher card', async () => {
    const w = await render(CARD)
    expect(getSpy).toHaveBeenCalledWith('/api/public/teachers/9')
    expect(w.get('[data-testid="teacher-public-name"]').text()).toBe('Guru Lain')
    expect(w.get('[data-testid="teacher-public-about"]').text()).toContain('Tentang')
    expect(w.get('[data-testid="teacher-public-bio"]').text()).toBe('Saya suka mengajar.')
    expect(w.get('[data-testid="teacher-public-subject"]').text()).toBe('Sains')
    expect(w.get('[data-testid="teacher-public-qualification"]').text()).toBe('Ijazah Sarjana Muda')
    expect(w.get('[data-testid="teacher-public-experience"]').text()).toBe('12 tahun')
    expect(w.text()).toContain('Maklumat Profesional')
  })

  it('never shows an IC, e-mail, phone or school, and has no edit control (read-only)', async () => {
    const w = await render(CARD)
    const text = w.text()
    expect(text).not.toMatch(/@|xxxxxx|No Kad Pengenalan|E-mel|Telefon|Sekolah/)
    expect(w.find('input, textarea, form, button').exists()).toBe(false)
  })

  it('shows "Guru ini belum menulis bio." and "—" for an empty bio, subject and qualification', async () => {
    const w = await render({ name: 'Guru Baharu', subject: null, bio: null, qualification: '', experienceYears: 0 })
    expect(w.get('[data-testid="teacher-public-bio-empty"]').text()).toBe('Guru ini belum menulis bio.')
    expect(w.get('[data-testid="teacher-public-subject"]').text()).toBe('—')
    expect(w.get('[data-testid="teacher-public-qualification"]').text()).toBe('—')
  })

  it('shows the BM server message (uniform 404) with a retry and no card', async () => {
    const w = await render(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' }), '999')
    expect(w.find('[data-testid="teacher-public-error"]').exists()).toBe(true)
    expect(w.text()).toContain('Rekod tidak dijumpai.')
    expect(w.find('[data-testid="teacher-public-name"]').exists()).toBe(false)
  })
})
