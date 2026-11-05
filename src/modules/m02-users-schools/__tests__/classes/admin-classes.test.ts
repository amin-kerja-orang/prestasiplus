// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import type { AdminClass } from '../../api/schools-admin'
import m02 from '../../mock'
import KelasSekolahPage from '../../pages/KelasSekolahPage.vue'
import routes from '../../routes'

describe('route /admin/classes', () => {
  it('is registered for the admin only in the admin layout', () => {
    const r = routes.find((x) => x.path === '/admin/classes')
    expect(r?.name).toBe('m02.admin-classes')
    expect(r?.meta).toMatchObject({ layout: 'admin', access: 'auth', roles: ['admin'] })
  })
})

describe('GET /api/admin/classes (API-ADM-05)', () => {
  let runtime: MockRuntime
  beforeAll(async () => {
    runtime = await bootMock({
      mode: 'test',
      plugins: [m01, m02, m03, m04, m10],
      clock: createClock({ at: CLOCK_ANCHOR_ISO }),
      latencyMs: 0,
      onWarn: null,
    })
  }, 60_000)
  const get = async (userId: number | null, url: string) => {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
    const res = await runtime.transport.request({ method: 'GET', url, headers })
    return {
      status: res.status,
      body: res.body as { data: AdminClass[]; meta: { totalItems: number } },
    }
  }

  it('lists classes in the AdminClass shape and filters by school and level', async () => {
    const all = await get(1, '/api/admin/classes')
    expect(all.status).toBe(200)
    expect(all.body.data.length).toBeGreaterThan(0)
    const row = all.body.data[0] as AdminClass
    expect(row).toMatchObject({
      level: expect.stringMatching(/^Tingkatan [1-5]$/),
      pupils: expect.any(Number),
    })
    const sid = row.school?.id ?? 0
    expect(sid).toBeGreaterThan(0)
    const bySchool = await get(1, `/api/admin/classes?schoolId=${String(sid)}`)
    expect(bySchool.body.data.every((c) => c.school?.id === sid)).toBe(true)
    expect(typeof row.isActive).toBe('boolean')
    const t = /\d/.exec(row.level)?.[0] ?? '1'
    const byLevel = await get(1, `/api/admin/classes?level=tingkatan-${t}`)
    expect(byLevel.body.data.every((c) => c.level === row.level)).toBe(true)
  })

  it('is admin only', async () => {
    expect((await get(null, '/api/admin/classes')).status).toBe(401)
    for (const id of [2, 5, 8]) expect((await get(id, '/api/admin/classes')).status).toBe(403)
  })
})

const api = vi.hoisted(() => ({
  fetchAdminClasses: vi.fn(),
  fetchAdminUsers: vi.fn(),
  fetchSchoolOptions: vi.fn(),
}))
vi.mock('../../api', async (orig) => ({ ...(await orig<object>()), ...api }))

function page(rows: AdminClass[]) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 25,
      totalItems: rows.length,
      totalPages: 1,
      from: rows.length ? 1 : null,
      to: rows.length || null,
    },
  }
}

describe('KelasSekolahPage', () => {
  let wrapper: VueWrapper | null = null
  async function render() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/admin/classes')
    wrapper = mount(KelasSekolahPage, { global: { plugins: [router] } })
    await flushPromises()
    return wrapper
  }
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const f of Object.values(api)) f.mockReset()
    api.fetchSchoolOptions.mockResolvedValue([{ id: 1, name: 'SMK CONTOH' }])
    api.fetchAdminUsers.mockResolvedValue({ data: [], meta: {} })
    api.fetchAdminClasses.mockResolvedValue(
      page([
        {
          id: 3,
          name: '4 Amanah',
          level: 'Tingkatan 4',
          teacher: { id: 9, name: 'CIKGU CONTOH' },
          school: { id: 1, name: 'SMK CONTOH' },
          pupils: 31,
          joinCode: 'AB12CD',
          isActive: false,
        },
      ]),
    )
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('shows the filters and the class row', async () => {
    const w = await render()
    const text = w.text()
    for (const l of ['Sekolah', 'Guru', 'Tingkatan', 'Cari', 'Kelas', 'Murid'])
      expect(text).toContain(l)
    expect(text).toContain('4 Amanah')
    expect(text).toContain('CIKGU CONTOH')
    expect(text).toContain('Kod Kelas')
    expect(text).toContain('AB12CD')
    expect(text).toContain('Tidak Aktif')
    expect(w.get('[data-testid=akp-school]').text()).toContain('SMK CONTOH')
    expect(w.get('[data-testid=akp-teacher]').attributes('disabled')).toBeDefined()
  })

  it('shows the empty state', async () => {
    api.fetchAdminClasses.mockResolvedValue(page([]))
    expect((await render()).text()).toContain('Tiada kelas dijumpai.')
  })

  it('shows the error state', async () => {
    api.fetchAdminClasses.mockRejectedValue(new Error('x'))
    expect((await render()).find('[data-testid=akp-error]').exists()).toBe(true)
  })
})
