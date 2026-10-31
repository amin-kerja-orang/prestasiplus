// @vitest-environment jsdom
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import type { AdminUserListItem } from '../../api/users'
import UserListPage from '../../pages/UserListPage.vue'
import { closeMenus, openRowMenu, pickRowMenuItem } from './menu'

const api = vi.hoisted(() => ({
  fetchAdminUsers: vi.fn(),
  fetchUserFilters: vi.fn(),
  deleteAdminUser: vi.fn(),
  bulkDeleteAdminUsers: vi.fn(),
  toggleUserActive: vi.fn(),
  impersonateUser: vi.fn(),
}))
vi.mock('../../api/users', () => api)

// `useConfirm` falls back to `window.confirm` when no `DsConfirmHost` is mounted (same BM text).
const dialogs = vi.hoisted(() => ({
  confirmNative: vi.fn<(message: string) => boolean>(() => true),
}))

const ME = 1

function user(id: number, extra: Partial<AdminUserListItem> = {}): AdminUserListItem {
  return {
    id,
    name: `Pengguna Contoh ${String(id)}`,
    email: `u${String(id)}@contoh.test`,
    phone: null,
    role: 'student',
    school: null,
    isActive: true,
    createdAt: '2026-09-21T10:00:00+08:00',
    avatarUrl: null,
    ...extra,
  }
}

function listResult(rows: AdminUserListItem[], total = rows.length, page = 1) {
  return {
    data: rows,
    meta: {
      page,
      pageSize: 25,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 25)),
      from: rows.length ? (page - 1) * 25 + 1 : null,
      to: rows.length ? (page - 1) * 25 + rows.length : null,
      roleCounts: {
        student: 4533,
        teacher: 551,
        parent: 38,
        sponsor: 6,
        schoolAdmin: 16,
        ppdOfficer: 5,
        admin: 2,
      },
    },
  }
}

/** The `<tr>` of a user: the table cells cannot carry the id, so it is found from the actions cell. */
function rowOf(w: VueWrapper, id: number): DOMWrapper<Element> {
  const tr = w.get(`[data-user-id="${String(id)}"]`).element.closest('tr')
  if (!tr) throw new Error(`No table row for user ${String(id)}`)
  return new DOMWrapper(tr)
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/users'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: UserListPage },
      { path: '/admin/users/:pathMatch(.*)*', component: { template: '<div />' } },
      { path: '/admin/import-students', component: { template: '<div />' } },
      { path: '/dashboard', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(UserListPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  dialogs.confirmNative.mockReset()
  dialogs.confirmNative.mockReturnValue(true)
  vi.spyOn(window, 'confirm').mockImplementation((message) => dialogs.confirmNative(message ?? ''))
  const session = useSessionStore()
  session.setSession({
    token: 'admin-token',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: { id: ME, role: 'admin', landingPath: '/admin/dashboard' } as never,
  })
  api.fetchUserFilters.mockResolvedValue([{ id: 7, name: 'SK CONTOH' }])
  api.fetchAdminUsers.mockResolvedValue(
    listResult(
      [
        user(ME, { name: 'Admin Contoh', role: 'admin' }),
        user(2, { school: { id: 7, name: 'SK CONTOH' }, phone: '0123456789' }),
        user(3, { role: 'school_admin', isActive: false }),
      ],
      5159,
    ),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('UserListPage (M02 S1)', () => {
  it('shows the 7 stat cards, the rows and the pager total', async () => {
    const w = await render()
    const counts = w
      .findAll('[data-testid^="users-stat-"]:not([data-testid="users-stats"])')
      .map((n) => n.text())
    expect(counts).toHaveLength(7)
    const expected = ['4533', '551', '38', '6', '16', '5', '2']
    expected.forEach((n, i) => expect((counts[i] ?? '').replace(/,/g, '')).toContain(n))
    expect(w.findAll('[data-testid="user-row"]')).toHaveLength(3)
    expect(w.text()).toContain('Menunjukkan 1-25 daripada 5159 hasil')
    expect(w.text()).toContain('5159')
    expect(w.text()).toContain('21/09/2026')
    expect(w.text()).toContain('0123456789')
  })

  it('never cuts a stat label (DV-M02-02): default-density tiles, no truncate class', async () => {
    const w = await render()
    const stats = w.get('[data-testid="users-stats"]')
    expect(stats.findAll('[data-compact]')).toHaveLength(0)
    expect(stats.findAll('.truncate')).toHaveLength(0)
    expect(stats.get('[data-testid="users-stat-ppd_officer"]').text()).toContain('Pegawai PPD')
  })

  it('lets the e-mail, name and school cells wrap instead of cutting them (DV-M02-01)', async () => {
    api.fetchAdminUsers.mockResolvedValue(
      listResult([
        user(2, {
          name: 'Pengguna Dengan Nama Yang Sangat Panjang Sekali',
          email: 'alamat.emel.yang.sangat.panjang.sekali@contoh.test',
          school: { id: 7, name: 'SEKOLAH MENENGAH KEBANGSAAN CONTOH' },
        }),
      ]),
    )
    const w = await render()
    const row = rowOf(w, 2)
    for (const id of ['user-name', 'user-email']) {
      const cell = row.get(`[data-testid="${id}"]`)
      expect(cell.classes(), id).not.toContain('truncate')
      expect(
        cell.classes().some((c) => c === 'break-words' || c === 'break-all'),
        id,
      ).toBe(true)
    }
    // The table cell is `nowrap`; the two cells must undo it or "wrap" is only a class on paper.
    const school = row.get('[data-testid="user-school"]')
    expect(school.classes()).toContain('whitespace-normal')
    expect(school.classes()).not.toContain('truncate')
    // School names wrap between words only: the 7rem cap fits the longest word ("KEBANGSAAN"), so no word is split.
    expect(school.classes()).toContain('max-w-52')
    expect(school.classes().some((c) => c === 'break-words' || c === 'break-all')).toBe(false)
    expect(row.get('[data-testid="user-identity"]').classes()).toContain('whitespace-normal')
    expect(row.get('[data-testid="user-email"]').text()).toBe(
      'alamat.emel.yang.sangat.panjang.sekali@contoh.test',
    )
    expect(row.get('[data-testid="user-school"]').text()).toBe('SEKOLAH MENENGAH KEBANGSAAN CONTOH')
    // The avatar initials carry their own `truncate`; the text column beside it must not.
    const textColumn = row.get('[data-testid="user-name"]').element.parentElement
    expect(textColumn?.querySelectorAll('.truncate')).toHaveLength(0)
  })

  it('rings only the card of the active role filter', async () => {
    const w = await render('/admin/users?role=teacher')
    const ringed = w.findAll('[data-active="true"]')
    expect(ringed).toHaveLength(1)
    expect(ringed[0]?.attributes('data-testid')).toBe('users-stat-teacher')
    expect(api.fetchAdminUsers.mock.calls[0]?.[0]).toMatchObject({ role: 'teacher' })
  })

  it('leaves the own row without checkbox, Login As and delete; Pakej only for school admins', async () => {
    const w = await render()
    const own = rowOf(w, ME)
    expect(own.find('[data-testid="user-select"]').exists()).toBe(false)
    expect(own.find('[data-testid="user-edit"]').exists()).toBe(true)
    expect(await openRowMenu(w, `[data-user-id="${String(ME)}"]`)).toEqual(['Nyahaktifkan'])
    closeMenus()
    expect(await openRowMenu(w, '[data-user-id="2"]')).toEqual([
      'Nyahaktifkan',
      'Login As',
      'Padam',
    ])
    closeMenus()
    expect(await openRowMenu(w, '[data-user-id="3"]')).toContain('Pakej')
    closeMenus()
    expect(rowOf(w, 3).get('[data-testid="user-status"]').text()).toBe('Tidak Aktif')
  })

  it('toggles after the native confirm and does nothing on cancel', async () => {
    api.toggleUserActive.mockResolvedValue({ data: { isActive: false }, status: 'Selesai.' })
    const w = await render()
    dialogs.confirmNative.mockReturnValueOnce(false)
    await pickRowMenuItem(w, '[data-user-id="2"]', 'Nyahaktifkan')
    expect(api.toggleUserActive).not.toHaveBeenCalled()
    await pickRowMenuItem(w, '[data-user-id="2"]', 'Nyahaktifkan')
    expect(dialogs.confirmNative).toHaveBeenLastCalledWith(
      'Pasti untuk menukar status pengguna ini?',
    )
    expect(api.toggleUserActive).toHaveBeenCalledWith(2)
    expect(api.fetchAdminUsers).toHaveBeenCalledTimes(2)
  })

  it('deletes through the modal', async () => {
    api.deleteAdminUser.mockResolvedValue({ data: { deleted: 2 }, status: 'ok' })
    const w = await render()
    await pickRowMenuItem(w, '[data-user-id="2"]', 'Padam')
    expect(document.body.textContent).toContain('Padam Pengguna?')
    expect(document.body.textContent).toContain('Anda pasti mahu memadam pengguna ini?')
    expect(document.querySelector('[data-testid="users-delete-name"]')?.textContent).toBe(
      'Pengguna Contoh 2',
    )
    ;(document.querySelector('[data-testid="users-delete-confirm"]') as HTMLElement).click()
    await flushPromises()
    expect(api.deleteAdminUser).toHaveBeenCalledWith(2)
    expect(api.fetchAdminUsers).toHaveBeenCalledTimes(2)
  })

  it('selects all selectable rows, shows the bulk bar and bulk deletes', async () => {
    api.bulkDeleteAdminUsers.mockResolvedValue({ data: { deleted: 2 }, status: 'ok' })
    const w = await render()
    await w.get('[data-testid="users-select-all"]').trigger('click')
    expect(w.get('[data-testid="users-selected-count"]').text()).toBe('2')
    expect(w.get('[data-testid="users-bulk-bar"]').text()).toContain('dipilih')
    await w.get('[data-testid="users-bulk-delete"]').trigger('click')
    expect(document.body.textContent).toContain('Padam Pengguna Terpilih?')
    expect(document.body.textContent).toContain('Tindakan ini tidak boleh dibatalkan.')
    ;(document.querySelector('[data-testid="users-bulk-confirm"]') as HTMLElement).click()
    await flushPromises()
    expect(api.bulkDeleteAdminUsers).toHaveBeenCalledWith([2, 3])
    expect(w.find('[data-testid="users-bulk-bar"]').exists()).toBe(false)
  })

  it('Login As replaces the session and goes to the landing path', async () => {
    api.impersonateUser.mockResolvedValue({
      token: 'student-token',
      expiresAt: '2099-01-01T00:00:00+08:00',
      user: { id: 2, role: 'student', landingPath: '/dashboard' },
    })
    const w = await render()
    await pickRowMenuItem(w, '[data-user-id="2"]', 'Login As')
    expect(dialogs.confirmNative).toHaveBeenLastCalledWith('Login sebagai Pengguna Contoh 2?')
    expect(useSessionStore().token).toBe('student-token')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('shows the empty state without a pager', async () => {
    api.fetchAdminUsers.mockResolvedValue(listResult([], 0))
    const w = await render('/admin/users?search=zzz')
    expect(w.get('[data-testid="users-empty"]').text()).toContain('Tiada pengguna dijumpai')
    expect(w.get('[data-testid="users-empty"]').text()).toContain('Cuba ubah kriteria carian anda')
    expect(w.text()).not.toContain('Menunjukkan')
  })

  it('goes back one page when a delete empties the current page (FR-M02-14)', async () => {
    api.deleteAdminUser.mockResolvedValue({ data: { deleted: 1 }, status: 'ok' })
    api.fetchAdminUsers
      .mockResolvedValueOnce(listResult([user(30)], 26, 2))
      .mockResolvedValueOnce(listResult([], 25, 2))
      .mockResolvedValue(listResult([user(2), user(3)], 25, 1))
    const w = await render('/admin/users?page=2')
    await pickRowMenuItem(w, '[data-user-id="30"]', 'Padam')
    ;(document.querySelector('[data-testid="users-delete-confirm"]') as HTMLElement).click()
    await flushPromises()
    expect(api.deleteAdminUser).toHaveBeenCalledWith(30)
    expect(router.currentRoute.value.query.page).toBe('1')
    expect(w.findAll('[data-testid="user-row"]')).toHaveLength(2)
  })

  it('shows the load error with "Cuba Semula" and retry reloads', async () => {
    api.fetchAdminUsers
      .mockRejectedValueOnce(new Error('gagal'))
      .mockResolvedValue(listResult([user(2)], 1))
    const w = await render()
    expect(w.find('[data-testid="users-error"]').exists()).toBe(true)
    const retry = w.findAll('button').find((b) => b.text() === 'Cuba Semula')
    expect(retry).toBeDefined()
    expect(w.find('[data-testid="user-row"]').exists()).toBe(false)
    await retry!.trigger('click')
    await flushPromises()
    expect(api.fetchAdminUsers).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid="users-error"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="user-row"]')).toHaveLength(1)
  })

  it('submits the filters into the URL', async () => {
    const w = await render()
    await w.get('[data-testid="users-status"]').setValue('0')
    await w.get('[data-testid="users-search"]').setValue(' ali ')
    await w.get('[data-testid="users-filter"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ is_active: '0', search: 'ali' })
    expect(api.fetchAdminUsers.mock.calls.at(-1)?.[0]).toMatchObject({
      isActive: false,
      search: 'ali',
    })
  })
})
