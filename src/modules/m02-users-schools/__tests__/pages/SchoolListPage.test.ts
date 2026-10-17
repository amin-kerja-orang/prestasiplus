// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { AdminSchool } from '../../api/schools-admin'
import SchoolListPage from '../../pages/SchoolListPage.vue'

const api = vi.hoisted(() => ({ fetchAdminSchools: vi.fn(), toggleSchool: vi.fn() }))
vi.mock('../../api/schools-admin', () => api)

function school(id: number, extra: Partial<AdminSchool> = {}): AdminSchool {
  return {
    id,
    name: `SK TAMAN CONTOH ${String(id)}`,
    code: `ABC${String(1000 + id)}`,
    type: 'SK',
    state: 'Selangor',
    district: 'PPD CONTOH',
    city: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00+08:00',
    updatedAt: '2026-01-01T00:00:00+08:00',
    studentCount: 0,
    teacherCount: 0,
    ...extra,
  }
}

function listResult(rows: AdminSchool[], total = rows.length, page = 1) {
  return {
    data: rows,
    meta: {
      page,
      pageSize: 30,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 30)),
      from: rows.length ? (page - 1) * 30 + 1 : null,
      to: rows.length ? (page - 1) * 30 + rows.length : null,
      counts: { total: 10220, active: 10212, inactive: 8 },
      types: ['SK', 'SMK'],
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/schools'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/schools', name: 'm02.schools.list', component: SchoolListPage },
      {
        path: '/admin/schools/create',
        name: 'm02.schools.create',
        component: { template: '<div />' },
      },
      {
        path: '/admin/schools/:id/edit',
        name: 'm02.schools.edit',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push(url)
  wrapper = mount(SchoolListPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchAdminSchools.mockReset()
  api.toggleSchool.mockReset()
  api.fetchAdminSchools.mockResolvedValue(
    listResult(
      [
        school(1, { studentCount: 3, teacherCount: 2 }),
        school(2, { isActive: false, type: 'SMK', code: '' }),
      ],
      10220,
    ),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SchoolListPage (M02 S9)', () => {
  it('shows the stat cards with thousands separators and the add card', async () => {
    const w = await render()
    expect(w.get('[data-testid=schools-stat-total]').text()).toContain('10,220')
    expect(w.get('[data-testid=schools-stat-total]').text()).toContain('Jumlah Sekolah')
    expect(w.get('[data-testid=schools-stat-active]').text()).toContain('10,212')
    expect(w.get('[data-testid=schools-stat-inactive]').text()).toContain('8')
    expect(w.get('[data-testid=schools-stat-inactive]').text()).toContain('Tidak Aktif')
    const add = w.get('[data-testid=schools-add]')
    expect(add.text()).toBe('Tambah Sekolah')
    expect(add.attributes('href')).toBe('/admin/schools/create')
  })

  it('renders the nine columns and one row per school', async () => {
    const w = await render()
    const headers = w.findAll('thead th').map((th) => th.text())
    expect(headers).toEqual([
      'Nama Sekolah',
      'Kod',
      'Jenis',
      'Negeri',
      'Daerah',
      'Pelajar',
      'Guru',
      'Status',
      'Tindakan',
    ])
    const rows = w.findAll('[data-testid=school-row]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('SK TAMAN CONTOH 1')
    expect(rows[0]?.text()).toContain('Selangor')
    expect(rows[0]?.get('[data-testid=school-status]').text()).toBe('Aktif')
    expect(rows[1]?.get('[data-testid=school-status]').text()).toBe('Tidak Aktif')
    expect(rows[0]?.get('[data-testid=school-edit]').attributes('href')).toBe(
      '/admin/schools/1/edit',
    )
    expect(rows[0]?.get('[data-testid=school-edit]').attributes('title')).toBe('Edit')
  })

  it('titles the toggle "Nyahaktif" for an active school and "Aktifkan" for an inactive one', async () => {
    const w = await render()
    const toggles = w.findAll('[data-testid=school-toggle]')
    expect(toggles[0]?.attributes('title')).toBe('Nyahaktif')
    expect(toggles[1]?.attributes('title')).toBe('Aktifkan')
  })

  it('offers "Semua Jenis" plus the types of meta.types, and the 16 states', async () => {
    const w = await render()
    const types = w.findAll('[data-testid=schools-type] option').map((o) => o.text())
    expect(types).toEqual(['Semua Jenis', 'SK', 'SMK'])
    const states = w.findAll('[data-testid=schools-state] option').map((o) => o.text())
    expect(states).toHaveLength(17)
    expect(states[0]).toBe('Semua Negeri')
    expect(states).toContain('Negeri Sembilan')
    expect(w.get('[data-testid=schools-search]').attributes('placeholder')).toBe(
      'Cari nama atau kod sekolah...',
    )
  })

  it('resets the filters from the filter bar and refetches the unfiltered list', async () => {
    const w = await render('/admin/schools?state=Perlis')
    expect(api.fetchAdminSchools).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'Perlis', search: null, type: null, page: 1 }),
    )
    const reset = w.findAll('button').find((b) => b.text() === 'Set Semula')
    expect(reset).toBeDefined()
    await reset?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/schools')
    expect(router.currentRoute.value.query).toEqual({})
    expect(api.fetchAdminSchools).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: null, search: null, type: null, page: 1 }),
    )
  })

  it('submits the filter as the query string and refetches', async () => {
    const w = await render()
    await w.get('[data-testid=schools-search]').setValue('  bangi ')
    await w.get('[data-testid=schools-state]').setValue('Perlis')
    await w.get('[data-testid=schools-type]').setValue('SK')
    await w.get('[data-testid=schools-filter]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      search: 'bangi',
      state: 'Perlis',
      type: 'SK',
    })
    expect(api.fetchAdminSchools).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'bangi', state: 'Perlis', type: 'SK' }),
    )
  })

  it('shows the empty row and no pager for no result', async () => {
    api.fetchAdminSchools.mockResolvedValue(listResult([], 0))
    const w = await render('/admin/schools?search=zzqxv')
    const empty = w.get('[data-testid=schools-empty]')
    expect(empty.text()).toBe('Tiada sekolah dijumpai')
    expect(empty.get('td').attributes('colspan')).toBe('9')
    expect(w.find('nav').exists()).toBe(false)
  })

  it('renders the pager summary and keeps the filters when paging', async () => {
    const w = await render('/admin/schools?type=SK')
    const pager = w.get('[data-testid=schools-pager]')
    expect(pager.text()).toContain('Menunjukkan 1-30 daripada 10220 hasil')
    await pager.get('button[aria-label="Page 2"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ type: 'SK', page: '2' })
  })

  it('toggles without confirmation, reloads with the same filters and shows the flash', async () => {
    api.toggleSchool.mockResolvedValue({
      data: { isActive: false },
      status: 'Status sekolah berjaya dikemaskini.',
    })
    const confirm = vi.spyOn(window, 'confirm')
    const w = await render('/admin/schools?state=Selangor')
    const calls = api.fetchAdminSchools.mock.calls.length
    await w.findAll('[data-testid=school-toggle]')[0]?.trigger('submit')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(api.toggleSchool).toHaveBeenCalledWith(1)
    expect(api.fetchAdminSchools.mock.calls.length).toBe(calls + 1)
    expect(api.fetchAdminSchools).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'Selangor' }),
    )
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Status sekolah berjaya dikemaskini.',
    })
  })

  it('shows an error flash when the toggle fails', async () => {
    api.toggleSchool.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Sekolah tidak dijumpai.' }),
    )
    const w = await render()
    await w.findAll('[data-testid=school-toggle]')[0]?.trigger('submit')
    await flushPromises()
    expect(useFlashStore().current).toEqual({
      type: 'error',
      message: ['Sekolah tidak dijumpai.'],
    })
  })

  it('shows the red box with a retry when the list cannot load', async () => {
    api.fetchAdminSchools.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    expect(w.get('[data-testid=schools-error]').text()).toContain('Ralat berlaku. Sila cuba lagi.')
    await w.get('[data-testid=schools-retry]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=schools-error]').exists()).toBe(false)
    expect(w.findAll('[data-testid=school-row]')).toHaveLength(2)
  })

  it('shows skeleton rows while the first load is pending', async () => {
    api.fetchAdminSchools.mockReturnValue(new Promise(() => undefined))
    const w = await render()
    expect(w.findAll('[data-testid=schools-skeleton]')).toHaveLength(5)
    expect(w.find('[data-testid=school-row]').exists()).toBe(false)
  })
})
