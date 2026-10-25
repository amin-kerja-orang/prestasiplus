// @vitest-environment jsdom
/**
 * M27 S8 "Kelas Sekolah" component tests (SRS M27 Part B v1.8 FR-M27-44, 49, 111…116; AC-M27-31.1…31.5,
 * 32.1…32.3) against a mocked client: tile and count line, columns, rows, links, filters, paginator, empty
 * and error states.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'
import { useSessionStore } from '@/stores/session'

import type { SchoolClassList, SchoolClassRow } from '../../api/school-admin'
import KelasSekolahPage from '../../pages/KelasSekolahPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchSchoolClasses: vi.fn() }))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  fetchSchoolClasses: api.fetchSchoolClasses,
}))

function row(id: number, over: Partial<SchoolClassRow> = {}): SchoolClassRow {
  return {
    key: `classroom:${String(id)}`,
    kind: 'classroom',
    id,
    name: `5 KELAS ${String(id)}`,
    subject: { id: 3, name: 'Kimia' },
    levelLabel: 'Tingkatan 5',
    teacherName: 'Cikgu Contoh',
    members: 1234,
    joinCode: 'ABC123',
    isActive: true,
    link: `/prestasi/kelas/${String(id)}`,
    ...over,
  }
}

function list(rows: SchoolClassRow[], over: Partial<SchoolClassList> = {}): SchoolClassList {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 25,
      totalItems: rows.length,
      totalPages: 1,
      from: rows.length ? 1 : null,
      to: rows.length ? rows.length : null,
      displayed: rows.length,
    },
    tiles: { activeClasses: rows.filter((r) => r.isActive).length },
    levels: [
      { code: 'tingkatan-4', label: 'Tingkatan 4' },
      { code: 'tingkatan-5', label: 'Tingkatan 5' },
    ],
    ...over,
  }
}

let router: Router

async function mountPage(
  data: SchoolClassList | ApiError,
  url = '/admin-sekolah/kelas',
): Promise<VueWrapper> {
  if (data instanceof ApiError) api.fetchSchoolClasses.mockRejectedValue(data)
  else api.fetchSchoolClasses.mockResolvedValue(data)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(KelasSekolahPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchSchoolClasses.mockReset()
  setRouteOutcome(null)
  usePageMeta().reset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('route and header (FR-M27-38, 40, 44)', () => {
  it('declares S8 in the user shell for school_admin only', () => {
    const s8 = routes.find((r) => r.path === '/admin-sekolah/kelas')
    expect(s8?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Kelas Sekolah - PRESTASIPLUS',
      header: { title: 'Kelas Sekolah' },
    })
  })

  it('takes the sub-line from the session school and shows the breadcrumb', async () => {
    useSessionStore().auth = {
      token: 't',
      remember: false,
      expiresAt: '2030-01-01T00:00:00+08:00',
      user: { school: { name: 'SMK Contoh Ujian' } },
    } as never
    const w = await mountPage(list([row(1)]))
    expect(usePageMeta().state.header).toEqual({
      title: 'Kelas Sekolah',
      subtitle: 'SMK Contoh Ujian',
    })
    expect(text(w, 'kl-crumb-back')).toBe('Dashboard Sekolah')
    expect(w.get('[data-testid="kl-crumb-back"]').attributes('href')).toBe('/admin-sekolah')
  })
})

describe('tile and count line (FR-M27-111; AC-M27-31.1)', () => {
  it('shows "Kelas Aktif" with the active count and "{n} kelas dipaparkan"', async () => {
    const w = await mountPage(
      list([row(1), row(2), row(3, { isActive: false })], { tiles: { activeClasses: 2 } }),
    )
    expect(text(w, 'kl-tile')).toContain('Kelas Aktif')
    expect(text(w, 'kl-tile')).toContain('2')
    expect(text(w, 'kl-displayed')).toBe('3 kelas dipaparkan')
  })
})

describe('table (FR-M27-112, 113, 115; AC-M27-31.2, 32.3)', () => {
  it('shows the seven columns in order', async () => {
    const w = await mountPage(list([row(1)]))
    expect(w.findAll('[data-testid="kl-table"] th').map((e) => e.text())).toEqual([
      '#',
      'Kelas',
      'Subjek',
      'Tingkatan',
      'Guru',
      'Murid',
      'Kod Kelas',
    ])
  })

  it('shows the values, the class name as a link to M08 S5 and "Tiada Subjek" without a subject', async () => {
    const w = await mountPage(
      list([
        row(2001, { name: '5 MARIKH - Kimia' }),
        row(2002, { subject: null, teacherName: null, joinCode: null }),
      ]),
    )
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.findAll('td').map((c) => c.text())).toEqual([
      '1',
      '5 MARIKH - Kimia',
      'Kimia',
      'Tingkatan 5',
      'Cikgu Contoh',
      '1,234',
      'ABC123',
    ])
    expect(w.findAll('[data-testid="kl-name"]')[0]?.attributes('href')).toBe('/prestasi/kelas/2001')
    expect(texts(w, 'kl-subject')).toEqual(['Kimia', 'Tiada Subjek'])
    expect(rows[1]?.findAll('td').map((c) => c.text())).toEqual([
      '2',
      '5 KELAS 2002',
      'Tiada Subjek',
      'Tingkatan 5',
      '-',
      '1,234',
      '-',
    ])
  })

  it('shows the badge "Tidak Aktif" for an inactive class only', async () => {
    const w = await mountPage(list([row(1), row(2, { isActive: false })]))
    const badges = w.findAll('[data-testid="kl-inactive"]')
    expect(badges).toHaveLength(1)
    expect(badges[0]?.text()).toBe('Tidak Aktif')
    expect(
      w.findAll('tbody tr')[1]?.find('[data-testid="kl-inactive"]').exists(),
    ).toBe(true)
  })

  it('numbers rows from meta.from', async () => {
    const base = list([row(26), row(27)])
    const w = await mountPage({
      ...base,
      meta: { ...base.meta, page: 2, from: 26, to: 27, totalItems: 27, totalPages: 2 },
    })
    expect(texts(w, 'kl-no')).toEqual(['26', '27'])
  })

  it('uses "Darjah n" levels as given by the API', async () => {
    const w = await mountPage(list([row(5, { levelLabel: 'Darjah 5' })]))
    expect(text(w, 'kl-level-cell')).toBe('Darjah 5')
  })
})

describe('empty state (AC-M27-31.4)', () => {
  it('shows "0 kelas dipaparkan", "Tiada kelas dijumpai" and "Sila cipta kelas terlebih dahulu"', async () => {
    const w = await mountPage(list([], { levels: [] }))
    expect(text(w, 'kl-displayed')).toBe('0 kelas dipaparkan')
    expect(text(w, 'kl-tile')).toContain('0')
    expect(text(w, 'kl-empty')).toContain('Tiada kelas dijumpai')
    expect(text(w, 'kl-empty')).toContain('Sila cipta kelas terlebih dahulu')
    expect(has(w, 'kl-row')).toBe(false)
    expect(w.find('[data-ds="data-table-pager"]').exists()).toBe(false)
  })
})

describe('filters (FR-M27-114; AC-M27-32.1)', () => {
  it('offers "Semua" and the levels of the school, and "Cari kelas..." as the search placeholder', async () => {
    const w = await mountPage(list([row(1)]))
    const select = w.get('[data-testid="kl-level"]')
    expect(select.findAll('option').map((o) => o.text())).toEqual([
      'Semua',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    expect(w.findAll('label').map((l) => l.text())).toContain('Tingkatan / Darjah')
    expect(w.get('[data-testid="kl-search"]').attributes('placeholder')).toBe('Cari kelas...')
  })

  it('initialises the controls from the URL and passes the query to the client', async () => {
    const w = await mountPage(
      list([row(1)]),
      '/admin-sekolah/kelas?level=tingkatan-5&search=marikh',
    )
    expect((w.get('[data-testid="kl-level"]').element as HTMLSelectElement).value).toBe(
      'tingkatan-5',
    )
    expect((w.get('[data-testid="kl-search"]').element as HTMLInputElement).value).toBe('marikh')
    expect(api.fetchSchoolClasses).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'tingkatan-5', search: 'marikh', page: 1 }),
    )
  })

  it('applies the level at once and drops the page', async () => {
    const w = await mountPage(list([row(1)]), '/admin-sekolah/kelas?page=2')
    await w.get('[data-testid="kl-level"]').setValue('tingkatan-4')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ level: 'tingkatan-4' })
  })

  it('applies the search on Enter and after a pause', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = await mountPage(list([row(1)]))
    const input = w.get('[data-testid="kl-search"]')
    await input.setValue('  marikh ')
    await input.trigger('input')
    expect(router.currentRoute.value.query).toEqual({})
    await vi.advanceTimersByTimeAsync(450)
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ search: 'marikh' })

    await input.setValue('sejarah')
    await w.get('[data-testid="kl-filters"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ search: 'sejarah' })
  })
})

describe('paginator (FR-M27-49; AC-M27-32.2)', () => {
  it('is hidden for one page and shows the Laravel wording for 26 or more classes', async () => {
    const one = await mountPage(list([row(1)]))
    expect(one.find('[data-ds="data-table-pager"]').exists()).toBe(false)

    const rows = Array.from({ length: 25 }, (_, i) => row(i + 1))
    const base = list(rows)
    const w = await mountPage(
      {
        ...base,
        meta: { ...base.meta, totalItems: 30, totalPages: 2, to: 25, displayed: 30 },
      },
      '/admin-sekolah/kelas?level=tingkatan-5',
    )
    expect(w.findAll('tbody tr')).toHaveLength(25)
    const nav = w.get('[data-ds="data-table-pager"]')
    expect(nav.text()).toContain('Menunjukkan 1-25 daripada 30 hasil')
    const next = nav.findAll('button').find((b) => b.text() === '2')
    await next!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ level: 'tingkatan-5', page: '2' })
  })
})

describe('states (FR-M27-48)', () => {
  it('shows the spinner while loading', async () => {
    api.fetchSchoolClasses.mockReturnValue(new Promise(() => undefined))
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/')
    const w = mount(KelasSekolahPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(has(w, 'kl-loading')).toBe(true)
    expect(has(w, 'kl-table')).toBe(false)
  })

  it('renders the global 403 outcome in place for a 403', async () => {
    const w = await mountPage(
      new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Akses ditolak.',
        method: 'GET',
        url: '/api/admin-sekolah/kelas',
      }),
    )
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'kl-error')).toBe(false)
    expect(has(w, 'kl-table')).toBe(false)
  })

  it('shows the BM load error, not the server text, for another failure (SWE)', async () => {
    const w = await mountPage(
      new ApiError({
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Server Error',
        method: 'GET',
        url: '/api/admin-sekolah/kelas',
      }),
    )
    expect(text(w, 'kl-error')).toContain('Tidak dapat memuatkan data. Sila cuba semula.')
    expect(text(w, 'kl-error')).not.toContain('Server Error')
    expect(has(w, 'kl-table')).toBe(false)
  })
})
