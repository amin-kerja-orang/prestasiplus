// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { AdminSubjectListItem } from '../../api/admin-subjects-levels'
import SubjectListPage from '../../pages/SubjectListPage.vue'

const api = vi.hoisted(() => ({
  fetchAdminSubjects: vi.fn(),
  setSubjectActive: vi.fn(),
  deleteSubject: vi.fn(),
}))
vi.mock('../../api/admin-subjects-levels', () => api)

const dialogs = vi.hoisted(() => ({
  confirmNative: vi.fn((message: string) => message !== ''),
  alertNative: vi.fn(),
}))
vi.mock('@/components/overlay/native-dialogs', () => dialogs)

function subject(id: number, extra: Partial<AdminSubjectListItem> = {}): AdminSubjectListItem {
  return {
    id,
    code: `SUB${String(id)}`,
    name: `Subjek ${String(id)}`,
    nameEn: `Subject ${String(id)}`,
    icon: 'calculator',
    color: '#EF4444',
    isCore: false,
    order: id,
    isActive: true,
    educationLevelIds: [10, 11],
    createdAt: '2026-01-01T00:00:00+08:00',
    updatedAt: '2026-01-01T00:00:00+08:00',
    questionCount: 13872,
    levels: [
      { id: 10, name: 'Tingkatan 4' },
      { id: 11, name: 'Tingkatan 5' },
    ],
    ...extra,
  }
}

function listResult(rows: AdminSubjectListItem[]) {
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
      { path: '/admin/subjects', name: 'm03.subjects.list', component: SubjectListPage },
      {
        path: '/admin/subjects/create',
        name: 'm03.subjects.create',
        component: { template: '<i/>' },
      },
      {
        path: '/admin/subjects/:id/edit',
        name: 'm03.subjects.edit',
        component: { template: '<i/>' },
      },
    ],
  })
  await router.push('/admin/subjects')
  wrapper = mount(SubjectListPage, { global: { plugins: [router] }, attachTo: document.body })
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
  api.fetchAdminSubjects.mockResolvedValue(
    listResult([
      subject(1, { isCore: true, name: 'Bahasa Melayu' }),
      subject(2, { icon: null, levels: [], isActive: false, color: '#0f766e', questionCount: 0 }),
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
  await wrapper?.findAll('[data-testid=subject-more]')[index]?.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  const item = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((n) =>
    (n.textContent ?? '').includes('Padam'),
  )
  item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

describe('SubjectListPage (M03 S6)', () => {
  it('shows the heading, the count and the add button', async () => {
    const w = await render()
    expect(w.get('[data-testid=subjects-count]').text()).toBe('Jumlah: 2 subjek')
    const add = w.get('[data-testid=subjects-add]')
    expect(add.text()).toBe('Tambah')
    expect(add.attributes('href')).toBe('/admin/subjects/create')
  })

  it('renders the ten column headers and one row per subject', async () => {
    const w = await render()
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      '#',
      'Ikon',
      'Nama (BM)',
      'Nama (EN)',
      'Kod',
      'Warna',
      'Teras?',
      'Soalan',
      'Aktif?',
      'Tindakan',
    ])
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('Bahasa Melayu')
    expect(rows[0]?.get('[data-testid=subject-code]').text()).toBe('SUB1')
    expect(rows[0]?.get('[data-testid=subject-levels]').text()).toBe('Tingkatan 4, Tingkatan 5')
    expect(rows[1]?.find('[data-testid=subject-levels]').exists()).toBe(false)
  })

  it('shows Teras / Elektif, the colour as stored and the question count', async () => {
    const w = await render()
    const rows = w.findAll('tbody tr')
    expect(rows[0]?.get('[data-testid=subject-core]').text()).toBe('Teras')
    expect(rows[1]?.get('[data-testid=subject-core]').text()).toBe('Elektif')
    expect(rows[1]?.get('[data-testid=subject-color]').text()).toBe('#0f766e')
    expect(rows[0]?.get('[data-testid=subject-questions]').text()).toBe('13872 soalan')
  })

  it('draws the icon tile with colour + 20 and leaves an empty tile for no icon', async () => {
    const w = await render()
    const tiles = w.findAll('[data-testid=subject-icon]')
    expect(tiles[0]?.attributes('style')).toContain('background-color')
    expect(tiles[0]?.find('svg').exists()).toBe(true)
    expect(tiles[1]?.find('svg').exists()).toBe(false)
    expect(tiles[1]?.text()).toBe('')
  })

  it('has an "Edit" link and a "Padam" item in the row menu', async () => {
    const w = await render()
    const row = w.findAll('tbody tr')[0]
    expect(row?.get('[data-testid=subject-edit]').attributes('href')).toBe('/admin/subjects/1/edit')
    expect(row?.get('[data-testid=subject-edit]').attributes('aria-label')).toBe('Edit')
    expect(row?.get('[data-testid=subject-more]').attributes('aria-label')).toBe('Tindakan')
  })

  it('flips the switch at once, sends the PATCH and shows no message', async () => {
    api.setSubjectActive.mockResolvedValue({ id: 1, isActive: false })
    const w = await render()
    const track = () => w.findAll('tbody tr')[0]!.get('[data-testid=subject-switch]')
    expect(track().attributes('aria-checked')).toBe('true')
    await w.findAll('[data-testid=subject-switch]')[0]?.trigger('click')
    expect(track().attributes('aria-checked')).toBe('false')
    await flushPromises()
    expect(api.setSubjectActive).toHaveBeenCalledWith(1, false)
    expect(dialogs.confirmNative).not.toHaveBeenCalled()
    expect(dialogs.alertNative).not.toHaveBeenCalled()
    expect(useFlashStore().current).toBeNull()
  })

  it('reverts and alerts "Gagal kemaskini status" when the server refuses', async () => {
    api.setSubjectActive.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    await w.findAll('[data-testid=subject-switch]')[0]?.trigger('click')
    await flushPromises()
    expect(dialogs.alertNative).toHaveBeenCalledWith('Gagal kemaskini status')
    expect(
      w.findAll('tbody tr')[0]!.get('[data-testid=subject-switch]').attributes('aria-checked'),
    ).toBe('true')
  })

  it('reverts and alerts "Ralat rangkaian" on a network failure', async () => {
    api.setSubjectActive.mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' }),
    )
    const w = await render()
    await w.findAll('[data-testid=subject-switch]')[1]?.trigger('click')
    await flushPromises()
    expect(dialogs.alertNative).toHaveBeenCalledWith('Ralat rangkaian')
    expect(
      w.findAll('tbody tr')[1]!.get('[data-testid=subject-switch]').attributes('aria-checked'),
    ).toBe('false')
  })

  it('ignores further clicks on a row while its PATCH is in flight', async () => {
    let resolve: (v: unknown) => void = () => undefined
    api.setSubjectActive.mockReturnValue(new Promise((r) => (resolve = r)))
    const w = await render()
    const button = w.findAll('[data-testid=subject-switch]')[0]
    await button?.trigger('click')
    await button?.trigger('click')
    expect(api.setSubjectActive).toHaveBeenCalledTimes(1)
    resolve({ id: 1, isActive: false })
    await flushPromises()
    await button?.trigger('click')
    expect(api.setSubjectActive).toHaveBeenCalledTimes(2)
  })

  it('does nothing when the delete confirm is dismissed', async () => {
    dialogs.confirmNative.mockReturnValueOnce(false)
    await render()
    await deleteViaMenu(0)
    expect(dialogs.confirmNative).toHaveBeenCalledWith('Adakah anda pasti mahu padam subjek ini?')
    expect(api.deleteSubject).not.toHaveBeenCalled()
  })

  it('deletes after the confirm, reloads and shows the success flash', async () => {
    api.deleteSubject.mockResolvedValue({ data: { deleted: 1 }, status: 'Subjek berjaya dipadam.' })
    const w = await render()
    api.fetchAdminSubjects.mockResolvedValue(listResult([subject(2)]))
    await deleteViaMenu(0)
    expect(api.deleteSubject).toHaveBeenCalledWith(1)
    expect(w.findAll('tbody tr')).toHaveLength(1)
    expect(w.get('[data-testid=subjects-count]').text()).toBe('Jumlah: 1 subjek')
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Subjek berjaya dipadam.',
    })
  })

  it('shows the placeholder load error when the list cannot load', async () => {
    api.fetchAdminSubjects.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    expect(w.get('[data-testid=subjects-error]').text()).toContain(
      'Ralat memuatkan data. Sila cuba semula.',
    )
    expect(w.find('[data-testid=subjects-table]').exists()).toBe(false)
  })

  it('renders nothing in the content area until the data is ready', async () => {
    api.fetchAdminSubjects.mockReturnValue(new Promise(() => undefined))
    const w = await render()
    expect(w.find('[data-testid=subjects-table]').exists()).toBe(false)
    expect(w.find('[data-testid=subjects-error]').exists()).toBe(false)
  })
})
