// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router'
import { usePageMeta } from '@/composables'
import { useFlashStore } from '@/stores/flash'

import type { CompStudentDetail } from '../../api/comp-students'
import CompStudentDetailPage from '../../pages/CompStudentDetailPage.vue'

const api = vi.hoisted(() => ({
  fetchCompStudent: vi.fn(),
  toggleCompCoins: vi.fn(),
  toggleCompActive: vi.fn(),
}))
vi.mock('../../api/comp-students', () => api)

function detail(extra: Partial<CompStudentDetail> = {}): CompStudentDetail {
  return {
    userId: 5901,
    username: '101234@prestasiplus.my',
    name: 'PELAJAR DEMO SATU BIN DEMO',
    icNumber: '090101101234',
    classLevel: 'T5',
    isActive: true,
    coinsEnabled: false,
    packageExpiresAt: '2026-12-31',
    originalSchoolName: 'SEKOLAH CONTOH',
    classLabel: '5 BESTARI',
    teacherName: 'GURU DEMO',
    syilingBalance: 0,
    coinBalance: 0,
    classes: [
      {
        name: '5 BESTARI',
        classCode: 'DMO201',
        subjectName: 'Kimia',
        teacherName: 'GURU DEMO',
        status: 'active',
      },
      {
        name: '5 CEMERLANG',
        classCode: 'DMO202',
        subjectName: null,
        teacherName: 'GURU DEMO',
        status: 'active',
      },
    ],
    ...extra,
  }
}

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/comp-students', component: stub },
      {
        path: '/admin/comp-students/:id',
        component: CompStudentDetailPage,
        props: (r) => ({ id: Number(r.params.id) }),
      },
    ],
  })
  await router.push('/admin/comp-students/5901')
  wrapper = mount(CompStudentDetailPage, {
    global: { plugins: [router] },
    props: { id: 5901 },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchCompStudent.mockReset().mockResolvedValue(detail())
  api.toggleCompCoins.mockReset()
  api.toggleCompActive.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  usePageMeta().reset()
  setRouteOutcome(null)
})

describe('CompStudentDetailPage (M02 S8) content', () => {
  it('sets the header and tab title from the name and shows the label/value grid', async () => {
    const w = await render()
    expect(usePageMeta().state.header).toEqual({
      title: 'PELAJAR DEMO SATU BIN DEMO',
      subtitle: 'Detail pelajar komplimen',
    })
    expect(document.title).toBe('Pelajar Komplimen - PELAJAR DEMO SATU BIN DEMO | PRESTASIPLUS')
    expect(w.findAll('dt').map((d) => d.text())).toEqual([
      'Username',
      'No. KP',
      'Sekolah asal',
      'Tingkatan',
      'Status akaun',
      'Syiling',
      'Pakej tamat',
      'Baki syiling / coins',
    ])
    expect(t(w, 'comp-username').text()).toBe('101234@prestasiplus.my')
    expect(t(w, 'comp-ic').text()).toBe('090101101234')
    expect(t(w, 'comp-school').text()).toBe('SEKOLAH CONTOH')
    expect(t(w, 'comp-level').text()).toBe('T5')
    expect(t(w, 'comp-status').text()).toBe('Aktif')
    expect(t(w, 'comp-coins').text()).toBe('OFF (tak boleh kumpul/claim)')
    expect(t(w, 'comp-expiry').text()).toBe('31/12/2026')
    expect(t(w, 'comp-balance').text()).toBe('0 syiling · 0 coins')
    expect(w.get('[data-ds="back-link"]').attributes('href')).toBe('/admin/comp-students')
  })

  it('shows "—" for a missing IC and the classes table with "—" for no subject', async () => {
    api.fetchCompStudent.mockResolvedValue(detail({ icNumber: null }))
    const w = await render()
    expect(t(w, 'comp-ic').text()).toBe('—')
    expect(t(w, 'comp-classes-title').text()).toBe('Kelas didaftar (2)')
    expect(
      t(w, 'comp-classes')
        .findAll('th')
        .map((h) => h.text()),
    ).toEqual(['Kelas', 'Subjek', 'Cikgu', 'Status'])
    const rows = w.findAll('[data-testid=comp-classes] tbody tr')
    expect(rows[0]!.text()).toContain('5 BESTARI DMO201')
    expect(rows[1]!.findAll('td')[1]!.text()).toBe('—')
    expect(rows[0]!.findAll('td')[3]!.text()).toBe('Aktif')
  })

  it('a 404 sets the standard 404 outcome and shows neither the card nor the red box', async () => {
    const outcome = useRouteOutcome()
    api.fetchCompStudent.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' }),
    )
    const w = await render()
    expect(outcome.value).toBe(404)
    expect(w.find('[data-testid=comp-card]').exists()).toBe(false)
    expect(w.find('[data-testid=comp-load-error]').exists()).toBe(false)
  })

  it('another failure keeps the red box with a retry', async () => {
    api.fetchCompStudent.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }),
    )
    const w = await render()
    expect(t(w, 'comp-load-error').text()).toContain(
      'Tidak dapat memuatkan pelajar komplimen. Sila cuba semula.',
    )
    expect(useRouteOutcome().value).toBeNull()
  })
})

describe('CompStudentDetailPage (M02 S8) toggles', () => {
  it('"Hidupkan syiling" toggles at once, reloads, flips to "Matikan syiling" and flashes', async () => {
    api.toggleCompCoins.mockResolvedValue({
      data: { coinsEnabled: true },
      status: 'Tindakan berjaya dilaksanakan.',
    })
    const w = await render()
    expect(t(w, 'comp-toggle-coins').text()).toBe('Hidupkan syiling')
    api.fetchCompStudent.mockResolvedValue(detail({ coinsEnabled: true }))
    await w.findAll('form')[0]!.trigger('submit')
    await flushPromises()
    expect(api.toggleCompCoins).toHaveBeenCalledWith(5901)
    expect(t(w, 'comp-coins').text()).toBe('ON')
    expect(t(w, 'comp-toggle-coins').text()).toBe('Matikan syiling')
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Tindakan berjaya dilaksanakan.',
    })
  })

  it('"Nyahaktif akaun" becomes "Aktifkan akaun" and the status Tidak Aktif', async () => {
    api.toggleCompActive.mockResolvedValue({
      data: { isActive: false },
      status: 'Tindakan berjaya dilaksanakan.',
    })
    const w = await render()
    expect(t(w, 'comp-toggle-active').text()).toBe('Nyahaktif akaun')
    api.fetchCompStudent.mockResolvedValue(detail({ isActive: false }))
    await w.findAll('form')[1]!.trigger('submit')
    await flushPromises()
    expect(api.toggleCompActive).toHaveBeenCalledWith(5901)
    expect(t(w, 'comp-status').text()).toBe('Tidak Aktif')
    expect(t(w, 'comp-toggle-active').text()).toBe('Aktifkan akaun')
  })

  it('a failed toggle flashes the error and keeps the page', async () => {
    api.toggleCompCoins.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Gagal.' }),
    )
    const w = await render()
    await w.findAll('form')[0]!.trigger('submit')
    await flushPromises()
    expect(useFlashStore().current).toEqual({
      type: 'error',
      message: ['Ralat berlaku. Sila cuba lagi.'],
    })
    expect(t(w, 'comp-coins').text()).toBe('OFF (tak boleh kumpul/claim)')
  })
})
