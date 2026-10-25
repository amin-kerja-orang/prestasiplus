// @vitest-environment jsdom
/**
 * M02 S1 in http mode (AM2-SW2-01/02/03/04/05): the real API sends opaque string ids and `role` mapped from
 * `roles[]` by the api layer, the session id is a number, "Login As" does not exist and "Pegawai JPN" is not a role.
 * Mock mode (flag off) keeps "Login As" and the 8 live roles.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import type { AdminUserListItem } from '../../api/users'
import UserListPage from '../../pages/UserListPage.vue'
import { closeMenus, openRowMenu } from './menu'

const mode = vi.hoisted(() => ({ http: true }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

const api = vi.hoisted(() => ({
  fetchAdminUsers: vi.fn(),
  fetchUserFilters: vi.fn(),
  deleteAdminUser: vi.fn(),
  bulkDeleteAdminUsers: vi.fn(),
  toggleUserActive: vi.fn(),
  impersonateUser: vi.fn(),
}))
vi.mock('../../api/users', () => api)

/** The session id is a number (`UserMe.id`); the list ids are the wire strings. */
const ME = 1

/** A list row as the api layer hands it over: wire string ids, `role` = first of `roles[]`. */
function row(id: string, extra: Record<string, unknown> = {}): AdminUserListItem {
  return {
    id,
    name: `Pengguna Contoh ${id}`,
    email: `u${id}@contoh.test`,
    username: null,
    phone: null,
    roles: ['student'],
    role: 'student',
    school: null,
    isActive: true,
    isSuspended: false,
    createdAt: '2026-09-21T10:00:00+08:00',
    avatarUrl: null,
    ...extra,
  } as unknown as AdminUserListItem
}

const META = {
  page: 1,
  pageSize: 25,
  totalItems: 3,
  totalPages: 1,
  from: 1,
  to: 3,
  roleCounts: {
    student: 3,
    teacher: 0,
    parent: 0,
    sponsor: 0,
    schoolAdmin: 1,
    ppdOfficer: 0,
    admin: 1,
  },
}

let wrapper: VueWrapper | null = null

async function render(url = '/admin/users'): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: UserListPage },
      { path: '/admin/users/:pathMatch(.*)*', component: { template: '<div />' } },
      { path: '/admin/import-students', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(UserListPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mode.http = true
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  useSessionStore().setSession({
    token: 'admin-token',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: { id: ME, role: 'admin', landingPath: '/admin/dashboard' } as never,
  })
  api.fetchUserFilters.mockResolvedValue([{ id: '2', name: 'SK CONTOH' }])
  api.fetchAdminUsers.mockResolvedValue({
    data: [
      row('1', { name: 'Admin Contoh', roles: ['admin'], role: 'admin' }),
      row('2', { school: { id: '2', name: 'SK CONTOH' } }),
      row('3', { roles: ['school_admin'], role: 'school_admin' }),
    ],
    meta: META,
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('UserListPage http mode', () => {
  it('gives the own row (string id vs number session id) no checkbox, no Login As and no Padam', async () => {
    const w = await render()
    const own = w.get('[data-user-id="1"]').element.closest('tr')!
    expect(own.querySelector('[data-testid="user-select"]')).toBeNull()
    expect(await openRowMenu(w, '[data-user-id="1"]')).toEqual(['Nyahaktifkan'])
    closeMenus()
    // The other rows keep their checkbox.
    const other = w.get('[data-user-id="2"]').element.closest('tr')!
    expect(other.querySelector('[data-testid="user-select"]')).not.toBeNull()
  })

  it('select-all leaves the own row out', async () => {
    const w = await render()
    await w.get('[data-testid="users-select-all"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="users-selected-count"]').text()).toBe('2')
  })

  it('has no "Login As" (the API has no impersonation), keeps Pakej for a school admin', async () => {
    const w = await render()
    expect(await openRowMenu(w, '[data-user-id="2"]')).toEqual(['Nyahaktifkan', 'Padam'])
    closeMenus()
    expect(await openRowMenu(w, '[data-user-id="3"]')).toEqual(['Pakej', 'Nyahaktifkan', 'Padam'])
    closeMenus()
  })

  it('shows the role label of the mapped role', async () => {
    const w = await render()
    expect(w.findAll('[data-testid="user-role"]').map((n) => n.text())).toEqual([
      'Admin',
      'Pelajar',
      'Admin Sekolah',
    ])
  })

  it('names the school filter chip from the string id of the URL', async () => {
    const w = await render('/admin/users?school=2')
    expect(w.text()).toContain('SK CONTOH')
    expect(w.text()).not.toContain('Sekolah 2')
  })

  it('leaves "Pegawai JPN" out of the Peranan filter', async () => {
    const w = await render()
    const values = w
      .get('[data-testid="users-role"]')
      .findAll('option')
      .map((o) => (o.element as HTMLOptionElement).value)
    expect(values).not.toContain('jpn_officer')
    expect(values).toContain('ppd_officer')
  })
})

describe('UserListPage mock mode (unchanged)', () => {
  it('keeps "Login As" and "Pegawai JPN"', async () => {
    mode.http = false
    api.fetchAdminUsers.mockResolvedValue({
      data: [row('2'), row('3', { roles: ['school_admin'], role: 'school_admin' })],
      meta: META,
    })
    const w = await render()
    expect(await openRowMenu(w, '[data-user-id="2"]')).toEqual([
      'Nyahaktifkan',
      'Login As',
      'Padam',
    ])
    closeMenus()
    const values = w
      .get('[data-testid="users-role"]')
      .findAll('option')
      .map((o) => (o.element as HTMLOptionElement).value)
    expect(values).toContain('jpn_officer')
  })
})
