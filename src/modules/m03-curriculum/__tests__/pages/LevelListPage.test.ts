// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { AdminEducationLevelListItem } from '../../api/admin-subjects-levels'
import LevelListPage from '../../pages/LevelListPage.vue'

const api = vi.hoisted(() => ({
  fetchAdminLevels: vi.fn(),
  setLevelActive: vi.fn(),
  deleteLevel: vi.fn(),
}))
vi.mock('../../api/admin-subjects-levels', () => api)

const dialogs = vi.hoisted(() => ({
  confirmNative: vi.fn((message: string) => message !== ''),
  alertNative: vi.fn(),
}))
vi.mock('@/components/overlay/native-dialogs', () => dialogs)

function level(
  id: number,
  extra: Partial<AdminEducationLevelListItem> = {},
): AdminEducationLevelListItem {
  return {
    id,
    code: `D${String(id)}`,
    name: `Darjah ${String(id)}`,
    nameEn: `Year ${String(id)}`,
    stage: 'primary',
    curriculum: 'KSSR',
    order: id,
    isActive: true,
    grade: id,
    createdAt: '2026-01-01T00:00:00+08:00',
    updatedAt: '2026-01-01T00:00:00+08:00',
    questionCount: 11396,
    subjectCount: 16,
    ...extra,
  }
}

function listResult(rows: AdminEducationLevelListItem[]) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: rows.length,
      totalItems: rows.length,
      totalPages: 1,
      from: 1,
      to: rows.length,
    },
  }
}

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/education-levels', name: 'm03.levels.list', component: LevelListPage },
      {
        path: '/admin/education-levels/create',
        name: 'm03.levels.create',
        component: { template: '<i/>' },
      },
      {
        path: '/admin/education-levels/:id/edit',
        name: 'm03.levels.edit',
        component: { template: '<i/>' },
      },
    ],
  })
  await router.push('/admin/education-levels')
  wrapper = mount(LevelListPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  dialogs.confirmNative.mockReset()
  // `useConfirm` falls back to `window.confirm` when no host is mounted.
  vi.spyOn(window, 'confirm').mockImplementation((message) =>
    Boolean(dialogs.confirmNative(message ?? '')),
  )
  dialogs.confirmNative.mockReturnValue(true)
  dialogs.alertNative.mockReset()
  api.fetchAdminLevels.mockResolvedValue(
    listResult([
      level(1),
      level(7, { stage: 'lower_secondary', code: 'T1', name: 'Tingkatan 1', curriculum: 'KSSM' }),
      level(10, { stage: 'upper_secondary', code: 'T4', name: 'Tingkatan 4', curriculum: 'KSSM' }),
    ]),
  )
})

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  wrapper = null
})


/** Opens the row menu (`DsRowActions`) of row `index` and picks "Padam". */
async function deleteViaMenu(index: number): Promise<void> {
  await wrapper?.findAll('[data-testid=level-more]')[index]?.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  const item = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((n) =>
    (n.textContent ?? '').includes('Padam'),
  )
  item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

describe('LevelListPage (M03 S9)', () => {
  it('shows the heading, the count and the pink add button', async () => {
    const w = await render()
    expect(w.get('h2').text()).toBe('Senarai Tahap Pendidikan')
    expect(w.get('[data-testid=levels-count]').text()).toBe('Jumlah: 3 tahap')
    const add = w.get('[data-testid=levels-add]')
    expect(add.text()).toBe('Tambah Tahap')
    expect(add.attributes('href')).toBe('/admin/education-levels/create')
  })

  it('renders the ten column headers and one row per level', async () => {
    const w = await render()
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      '#',
      'Nama (BM)',
      'Nama (EN)',
      'Kod',
      'Peringkat',
      'Kurikulum',
      'Soalan',
      'Subjek',
      'Aktif?',
      'Tindakan',
    ])
    expect(w.findAll('tbody tr')).toHaveLength(3)
  })

  it('labels the stage badges and shows the counts at every width', async () => {
    const w = await render()
    const rows = w.findAll('tbody tr')
    expect(rows.map((r) => r.get('[data-testid=level-stage]').text())).toEqual([
      'Rendah',
      'Menengah Rendah',
      'Menengah Atas',
    ])
    expect(rows[0]?.get('[data-testid=level-questions]').text()).toBe('11396 soalan')
    expect(rows[0]?.get('[data-testid=level-subjects]').text()).toBe('16 subjek')
    expect(rows[0]?.get('[data-testid=level-edit]').attributes('href')).toBe(
      '/admin/education-levels/1/edit',
    )
  })

  it('flips the switch at once and PATCHes without a dialog', async () => {
    api.setLevelActive.mockResolvedValue({ id: 1, isActive: false })
    const w = await render()
    await w.findAll('[data-testid=level-switch]')[0]?.trigger('click')
    expect(
      w.findAll('tbody tr')[0]!.get('[data-testid=level-switch]').attributes('aria-checked'),
    ).toBe('false')
    await flushPromises()
    expect(api.setLevelActive).toHaveBeenCalledWith(1, false)
    expect(dialogs.confirmNative).not.toHaveBeenCalled()
    expect(dialogs.alertNative).not.toHaveBeenCalled()
  })

  it('reverts and alerts on a server failure and on a network failure', async () => {
    api.setLevelActive.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    api.setLevelActive.mockRejectedValueOnce(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' }),
    )
    const w = await render()
    await w.findAll('[data-testid=level-switch]')[0]?.trigger('click')
    await flushPromises()
    expect(dialogs.alertNative).toHaveBeenLastCalledWith('Gagal kemaskini status')
    await w.findAll('[data-testid=level-switch]')[0]?.trigger('click')
    await flushPromises()
    expect(dialogs.alertNative).toHaveBeenLastCalledWith('Ralat rangkaian')
    expect(
      w.findAll('tbody tr')[0]!.get('[data-testid=level-switch]').attributes('aria-checked'),
    ).toBe('true')
  })

  it('confirms with the level copy, deletes, reloads and flashes success', async () => {
    api.deleteLevel.mockResolvedValue({
      data: { deleted: 1 },
      status: 'Tahap Pendidikan berjaya dipadam.',
    })
    const w = await render()
    api.fetchAdminLevels.mockResolvedValue(listResult([level(1), level(7)]))
    await deleteViaMenu(2)
    expect(dialogs.confirmNative).toHaveBeenCalledWith(
      'Adakah anda pasti mahu padam tahap pendidikan ini?',
    )
    expect(api.deleteLevel).toHaveBeenCalledWith(10)
    expect(w.get('[data-testid=levels-count]').text()).toBe('Jumlah: 2 tahap')
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Tahap Pendidikan berjaya dipadam.',
    })
  })

  it('ignores further clicks on a row while its PATCH is in flight', async () => {
    let resolve: (v: unknown) => void = () => undefined
    api.setLevelActive.mockReturnValue(new Promise((r) => (resolve = r)))
    const w = await render()
    const button = w.findAll('[data-testid=level-switch]')[0]
    await button?.trigger('click')
    await button?.trigger('click')
    expect(api.setLevelActive).toHaveBeenCalledTimes(1)
    resolve({ id: 1, isActive: false })
    await flushPromises()
    await button?.trigger('click')
    expect(api.setLevelActive).toHaveBeenCalledTimes(2)
  })

  it('sends nothing when the delete confirm is dismissed', async () => {
    dialogs.confirmNative.mockReturnValueOnce(false)
    await render()
    await deleteViaMenu(0)
    expect(api.deleteLevel).not.toHaveBeenCalled()
  })

  it('shows the placeholder load error', async () => {
    api.fetchAdminLevels.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    expect(w.get('[data-testid=levels-error]').text()).toContain(
      'Ralat memuatkan data. Sila cuba semula.',
    )
  })
})
