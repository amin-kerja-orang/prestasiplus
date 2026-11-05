// @vitest-environment jsdom
/**
 * M27 S6 and S7 component tests (SRS M27 Part B FR-M27-88 to 93, 99 to 103, 119; AC 25.1 to 26.3, 28.1 to 29.5, 35.x)
 * against a mocked client: exact BM copy, the single count card, the header-actions row, columns, the empty row, the
 * read-only pupil badge, the S7 toggle with the native confirm, the filter form, the pager, the CSV button.
 */
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'
import { useFlashStore } from '@/stores/flash'

import SenaraiGuruPage from '../../pages/SenaraiGuruPage.vue'
import SenaraiPelajarPage from '../../pages/SenaraiPelajarPage.vue'
import { has, mountAt, pupil, teacher, text } from './helpers'

const api = vi.hoisted(() => ({
  fetchSchoolPupils: vi.fn(),
  fetchSchoolTeachers: vi.fn(),
  fetchSchoolClasses: vi.fn(),
  downloadPupilsCsv: vi.fn(),
  downloadTeachersCsv: vi.fn(),
  toggleSchoolTeacherActive: vi.fn(),
}))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  ...api,
}))

const save = vi.hoisted(() => ({ saveBlob: vi.fn() }))
vi.mock('@/lib/save-blob', () => save)

function list<T>(
  rows: T[],
  over: Record<string, unknown> = {},
  counts: { total: number; active: number; inactive: number; xs?: number; notCounted?: number } = {
    total: rows.length,
    active: rows.length,
    inactive: 0,
  },
) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 25,
      totalItems: rows.length,
      totalPages: 1,
      from: rows.length === 0 ? null : 1,
      to: rows.length === 0 ? null : rows.length,
      counts,
      ...over,
    },
  }
}

/** One page of `fetchSchoolClasses` (the "Kelas" select options). */
function classPage(rows: { id: number; name: string; levelLabel: string }[]) {
  return {
    data: rows,
    meta: { page: 1, pageSize: 25, totalItems: rows.length, totalPages: 1, from: 1, to: rows.length, displayed: rows.length },
    tiles: { activeClasses: rows.length },
    levels: [],
  }
}

const inactivePupil = () =>
  pupil({
    id: 3002,
    name: 'Murid Dua',
    initials: 'MD',
    phone: null,
    gradeLabel: null,
    classNames: [],
    isActive: false,
    canEdit: false,
  })

/** Runs `fn` with `matchMedia` answering for a viewport `width` (jsdom has none: every breakpoint counts as reached). */
async function atWidth<T>(width: number, fn: () => Promise<T>): Promise<T> {
  const matchMedia = vi.fn((q: string) => {
    const min = Number(/(?:min-width:|width >=)\s*(\d+)px/.exec(q)?.[1] ?? 0)
    return { matches: width >= min, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  })
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia
  try {
    return await fn()
  } finally {
    delete (window as { matchMedia?: unknown }).matchMedia
  }
}

async function mountPupils(
  data: ReturnType<typeof list> | ApiError = list([pupil(), inactivePupil()]),
  url = '/admin-sekolah/pelajar',
) {
  if (data instanceof ApiError) api.fetchSchoolPupils.mockRejectedValue(data)
  else api.fetchSchoolPupils.mockResolvedValue(data)
  return mountAt(SenaraiPelajarPage, url)
}

const inactiveTeacher = () =>
  teacher({
    id: 6,
    name: 'Guru Dua',
    initials: 'GD',
    classCount: 0,
    lastLoginAt: '2000-01-01T00:00:00+08:00',
    isActive: false,
    canEdit: false,
  })

async function mountTeachers(
  data: ReturnType<typeof list> | ApiError = list([teacher(), inactiveTeacher()]),
  url = '/admin-sekolah/guru',
) {
  if (data instanceof ApiError) api.fetchSchoolTeachers.mockRejectedValue(data)
  else api.fetchSchoolTeachers.mockResolvedValue(data)
  return mountAt(SenaraiGuruPage, url)
}

beforeEach(() => {
  vi.restoreAllMocks()
  for (const fn of Object.values(api)) fn.mockReset()
  save.saveBlob.mockReset()
  api.fetchSchoolClasses.mockResolvedValue(classPage([]))
  setRouteOutcome(null)
  usePageMeta().reset()
})

describe('S6 Senarai Pelajar (FR-M27-88 to 93)', () => {
  it('sets the header with the school name and shows the breadcrumb "← Dashboard Sekolah"', async () => {
    const { wrapper: w } = await mountPupils()
    expect(usePageMeta().state.header).toEqual({
      title: 'Senarai Pelajar',
      subtitle: 'SMK Contoh Ujian',
    })
    const back = w.get('[data-testid="user-crumb-back"]')
    expect(back.text()).toBe('Dashboard Sekolah')
    expect(back.attributes('href')).toBe('/admin-sekolah')
  })

  it('the count is XS-1 and "{m} menunggu kelulusan atau tidak aktif" shows beside it only when m > 0 (FR-AS-51-2)', async () => {
    const counts = { total: 20, active: 18, inactive: 2, xs: 17, notCounted: 3 }
    const { wrapper: w } = await mountPupils(list([pupil()], {}, counts))
    expect(text(w, 'user-count-card')).toContain('17')
    expect(text(w, 'user-count-card')).not.toContain('20')
    expect(text(w, 'user-not-counted')).toBe('3 menunggu kelulusan atau tidak aktif')
    const none = await mountPupils(list([pupil()], {}, { total: 17, active: 17, inactive: 0, xs: 17, notCounted: 0 }))
    expect(has(none.wrapper, 'user-not-counted')).toBe(false)
  })

  it('shows one count card "Pelajar" (unfiltered total) and "{n} pengguna dijumpai"', async () => {
    const { wrapper: w } = await mountPupils(
      list(
        [pupil()],
        { totalItems: 1234, totalPages: 50 },
        { total: 2000, active: 1900, inactive: 100 },
      ),
    )
    expect(w.findAll('[data-testid="user-count-card"] > [data-ds="stat-tile"]')).toHaveLength(1)
    expect(text(w, 'user-count-card')).toContain('2,000')
    expect(text(w, 'user-count-card')).toContain('Pelajar')
    expect(text(w, 'user-found')).toBe('1,234 pengguna dijumpai')
  })

  it('shows "Eksport CSV" (with its title) and "Tambah Pelajar" linking to S12, no import / delete / checkbox', async () => {
    const { wrapper: w } = await mountPupils()
    const exp = w.get('[data-testid="user-export"]')
    expect(exp.text()).toBe('Eksport CSV')
    expect(exp.attributes('title')).toBe('Muat turun senarai mengikut tapisan di atas')
    const add = w.get('[data-testid="user-add"]')
    expect(add.text()).toBe('Tambah Pelajar')
    expect(add.attributes('href')).toBe('/admin-sekolah/pelajar/baru')
    expect(w.text()).not.toMatch(/Import|Padam|Login As/)
    expect(w.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('lays out each teacher card with the "Aktif?" toggle and the actions below the fields (G5-M27 B1)', async () => {
    await atWidth(375, async () => {
      const { wrapper: w } = await mountTeachers()
      const card = w.get('[data-ds="data-table-cards"] li')
      expect(card.element.children).toHaveLength(1)
      for (const dd of card.findAll('dd')) expect(dd.classes()).not.toContain('truncate')
      const fields = card.get('[data-testid="m27-card-fields"]').element
      const actions = card.get('[data-testid="m27-card-actions"]').element
      expect(
        fields.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      const toggle = actions.querySelector('button')
      expect(toggle?.textContent?.trim()).toBe('Aktif')
    })
  })

  it('has the nine column heads in order', async () => {
    const { wrapper: w } = await mountPupils()
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      '#',
      'Nama',
      'Emel',
      'Telefon',
      'Tingkatan',
      'Kelas',
      'Aktif?',
      'Tarikh',
      'Tindakan',
    ])
  })

  it('renders an active pupil with a name link, "Edit", the grade, classes and dd/mm/yyyy date', async () => {
    const { wrapper: w } = await mountPupils()
    const row = w.findAll('tbody tr')[0]!
    expect(row.get('[data-testid="user-index"]').text()).toBe('1')
    expect(row.get('[data-ds="identity"]').text()).toContain('MC')
    const name = row.get('[data-testid="user-name"]')
    expect(name.element.tagName).toBe('A')
    expect(name.attributes('href')).toBe('/admin-sekolah/pelajar/3001')
    expect(row.get('[data-testid="user-grade"]').text()).toBe('Tingkatan 5')
    expect(row.get('[data-testid="user-classes"]').text()).toBe('5 Amanah, 5 Bestari')
    expect(row.get('[data-testid="user-status"]').text()).toBe('Aktif')
    expect(row.get('[data-testid="user-date"]').text()).toBe('04/03/2026')
    const edit = row.get('[data-testid="user-edit"]')
    expect(edit.attributes('title')).toBe('Edit')
    expect(edit.attributes('href')).toBe('/admin-sekolah/pelajar/3001')
  })

  it('shows the value of every hidden column under the name, the date always (Codex P2, DV-M27-24)', async () => {
    const sub = (w: Awaited<ReturnType<typeof mountPupils>>['wrapper'], k: string) =>
      w.findAll('tbody tr')[0]!.find(`[data-testid="user-sub-${k}"]`)
    // 768: Tingkatan, Kelas, Telefon and Tarikh are all under the name.
    await atWidth(768, async () => {
      const { wrapper: w } = await mountPupils()
      expect(sub(w, 'grade').text()).toBe('Tingkatan 5')
      expect(sub(w, 'kelas').text()).toBe('Kelas: 5 Amanah, 5 Bestari')
      expect(sub(w, 'phone').text()).toMatch(/^Telefon: /)
      expect(sub(w, 'date').text()).toBe('Tarikh: 04/03/2026')
      expect(sub(w, 'last-login').exists()).toBe(false)
    })
    // 1280: Tingkatan and Kelas have their columns; Telefon and Tarikh stay under the name.
    await atWidth(1280, async () => {
      const { wrapper: w } = await mountPupils()
      expect(sub(w, 'grade').exists()).toBe(false)
      expect(sub(w, 'kelas').exists()).toBe(false)
      expect(sub(w, 'phone').exists()).toBe(true)
      expect(sub(w, 'date').text()).toBe('Tarikh: 04/03/2026')
    })
    // 1536: Tarikh has no column that fits, so the line is still there.
    await atWidth(1536, async () => {
      const { wrapper: w } = await mountPupils()
      expect(sub(w, 'phone').exists()).toBe(false)
      expect(sub(w, 'date').text()).toBe('Tarikh: 04/03/2026')
    })
  })

  it('lists "Tarikh" on the card of a pupil below md', async () => {
    await atWidth(375, async () => {
      const { wrapper: w } = await mountPupils()
      const card = w.get('[data-ds="data-table-cards"] li')
      expect(card.text()).toContain('Tarikh')
      expect(card.text()).toContain('04/03/2026')
    })
  })

  it('sizes the pupil columns so the table fits 1280 and "Tingkatan 5" stays whole; below xl is unchanged (G5-M27 B7)', async () => {
    const { wrapper: w } = await mountPupils()
    const th = (label: string) => w.findAll('thead th').find((e) => e.text() === label)!
    // base (below xl) widths, as before: # 48, Nama 192, Emel 176, Aktif? 96, Tindakan 160
    expect(th('#').classes()).toEqual(expect.arrayContaining(['w-12', 'xl:w-10']))
    expect(th('Nama').classes()).toContain('w-48')
    expect(th('Nama').classes()).not.toContain('xl:w-64')
    expect(th('Emel').classes()).toEqual(expect.arrayContaining(['w-44', 'xl:w-40']))
    expect(th('Aktif?').classes()).toContain('w-24')
    expect(th('Tindakan').classes()).toContain('w-40')
    // Tingkatan (~90px of text) and Kelas show from xl only, wide enough for the text
    expect(th('Tingkatan').classes()).toEqual(
      expect.arrayContaining(['w-32', 'hidden', 'xl:table-cell']),
    )
    expect(th('Kelas').classes()).toEqual(
      expect.arrayContaining(['w-36', 'hidden', 'xl:table-cell']),
    )
  })

  it('lays out each pupil card as fields with the actions below them, values wrapping (G5-M27 B1)', async () => {
    await atWidth(375, async () => {
      const { wrapper: w } = await mountPupils()
      const card = w.get('[data-ds="data-table-cards"] li')
      // nothing sits beside the fields: the card body is the only child of the row
      expect(card.element.children).toHaveLength(1)
      const dds = card.findAll('dd')
      expect(dds.map((d) => d.text())).toEqual([
        'murid1@demo.test',
        '0191234567',
        'Tingkatan 5',
        '5 Amanah, 5 Bestari',
        '04/03/2026',
      ])
      for (const dd of dds) {
        expect(dd.classes()).not.toContain('truncate')
        expect(dd.classes()).toContain('break-words')
      }
      const fields = card.get('[data-testid="m27-card-fields"]').element
      const actions = card.get('[data-testid="m27-card-actions"]').element
      expect(
        fields.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(fields.contains(actions)).toBe(false)
      expect(card.get('[data-testid="user-edit"]').text()).toBe('Edit')
      expect(actions.textContent).toContain('Aktif')
    })
  })

  it('opens the editor from the card title like the default card did', async () => {
    await atWidth(375, async () => {
      const { wrapper: w, router } = await mountPupils()
      await w.get('[data-ds="data-table-cards"] li button').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/admin-sekolah/pelajar/3001')
    })
  })

  it('renders an inactive pupil with no link and no "Edit", "-" cells and a red read-only "Tidak" badge', async () => {
    const { wrapper: w } = await mountPupils()
    const row = w.findAll('tbody tr')[1]!
    expect(row.get('[data-testid="user-name"]').element.tagName).toBe('SPAN')
    expect(row.find('[data-testid="user-edit"]').exists()).toBe(false)
    expect(row.get('[data-testid="user-phone"]').text()).toBe('-')
    expect(row.get('[data-testid="user-grade"]').text()).toBe('-')
    expect(row.get('[data-testid="user-classes"]').text()).toBe('-')
    const badge = row.get('[data-testid="user-status"]')
    expect(badge.text()).toBe('Tidak')
    expect(badge.element.tagName).toBe('SPAN')
    // the only button is the disabled "Menyamar" (FR-M27-121)
    expect(row.findAll('button').map((b) => b.text())).toEqual(['Menyamar'])
    expect(row.get('[data-testid="user-impersonate"]').attributes('title')).toBe(
      'Akaun ini tidak aktif',
    )
  })

  it('numbers rows from meta.from and asks for the page in the URL', async () => {
    const { wrapper: w } = await mountPupils(
      list([pupil(), pupil({ id: 3002 })], {
        page: 2,
        from: 26,
        to: 27,
        totalItems: 27,
        totalPages: 2,
      }),
      '/admin-sekolah/pelajar?page=2',
    )
    expect(w.findAll('[data-testid="user-index"]').map((e) => e.text())).toEqual(['26', '27'])
    expect(api.fetchSchoolPupils).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('shows the empty row and no pager for a school without pupils', async () => {
    const { wrapper: w } = await mountPupils(list([], {}, { total: 0, active: 0, inactive: 0 }))
    expect(text(w, 'user-empty')).toContain('Tiada pengguna dijumpai')
    expect(text(w, 'user-empty')).toContain('Cuba ubah kriteria carian anda')
    expect(text(w, 'user-found')).toBe('0 pengguna dijumpai')
    expect(w.find('[data-ds="data-table-pager"]').exists()).toBe(false)
  })

  it('has the filter form: Status options, Cari with its placeholder, submit "Cari"; Tingkatan and Kelas selects; no role / school control', async () => {
    const { wrapper: w } = await mountPupils()
    const select = w.get('[data-testid="user-status-filter"]')
    expect(select.findAll('option').map((o) => [o.attributes('value'), o.text()])).toEqual([
      ['', 'Semua'],
      ['1', 'Aktif'],
      ['0', 'Tidak Aktif'],
    ])
    expect(w.get('[data-testid="user-search"]').attributes('placeholder')).toBe('Nama atau emel...')
    expect(w.get('[data-ds="filter-bar"] button[type="submit"]').text()).toBe('Cari')
    expect(w.get('[data-testid="user-filter"]').findAll('select')).toHaveLength(3)
    expect(w.get('[data-testid="user-filter"]').text()).not.toContain('Peranan')
  })

  it('Tingkatan lists "Semua Tingkatan" and Tingkatan 1 to 5; Kelas starts with "Semua Kelas" (FR-AS-51-1)', async () => {
    api.fetchSchoolClasses.mockResolvedValue(
      classPage([
        { id: 12, name: '5 Bestari', levelLabel: 'Tingkatan 5' },
        { id: 11, name: '4 Cekap', levelLabel: 'Tingkatan 4' },
        { id: 10, name: '4 Amanah', levelLabel: 'Tingkatan 4' },
      ]),
    )
    const { wrapper: w } = await mountPupils()
    expect(
      w.get('[data-testid="user-level-filter"]').findAll('option').map((o) => [o.attributes('value'), o.text()]),
    ).toEqual([
      ['', 'Semua Tingkatan'],
      ['T1', 'Tingkatan 1'],
      ['T2', 'Tingkatan 2'],
      ['T3', 'Tingkatan 3'],
      ['T4', 'Tingkatan 4'],
      ['T5', 'Tingkatan 5'],
    ])
    // Tingkatan then name.
    expect(
      w.get('[data-testid="user-class-filter"]').findAll('option').map((o) => [o.attributes('value'), o.text()]),
    ).toEqual([
      ['', 'Semua Kelas'],
      ['10', '4 Amanah'],
      ['11', '4 Cekap'],
      ['12', '5 Bestari'],
    ])
    expect(w.get('[data-testid="user-filter"]').text()).toContain('Tingkatan')
  })

  it('choosing a Tingkatan limits the Kelas options to it and drops a class of another Tingkatan', async () => {
    api.fetchSchoolClasses.mockImplementation((o: { level?: string | null }) =>
      Promise.resolve(
        classPage(
        [
          { id: 12, name: '5 Bestari', levelLabel: 'Tingkatan 5' },
          { id: 10, name: '4 Amanah', levelLabel: 'Tingkatan 4' },
        ].filter((c) => !o.level || o.level === `tingkatan-${c.levelLabel.slice(-1)}`),
        ),
      ),
    )
    const { wrapper: w } = await mountPupils(undefined, '/admin-sekolah/pelajar?classroomId=12')
    expect((w.get('[data-testid="user-class-filter"]').element as HTMLSelectElement).value).toBe('12')
    await w.get('[data-testid="user-level-filter"]').setValue('T4')
    await flushPromises()
    expect(api.fetchSchoolClasses).toHaveBeenLastCalledWith(expect.objectContaining({ level: 'tingkatan-4' }))
    expect(w.get('[data-testid="user-class-filter"]').findAll('option').map((o) => o.text())).toEqual([
      'Semua Kelas',
      '4 Amanah',
    ])
    expect((w.get('[data-testid="user-class-filter"]').element as HTMLSelectElement).value).toBe('')
  })

  it('reads level and classroomId from the URL, sends them to the endpoint and writes them back on submit (AC-AS-53-2)', async () => {
    api.fetchSchoolClasses.mockResolvedValue(classPage([{ id: 10, name: '4 Amanah', levelLabel: 'Tingkatan 4' }]))
    const { wrapper: w, router } = await mountPupils(undefined, '/admin-sekolah/pelajar?classroomId=10&level=T4&page=2')
    expect((w.get('[data-testid="user-level-filter"]').element as HTMLSelectElement).value).toBe('T4')
    expect((w.get('[data-testid="user-class-filter"]').element as HTMLSelectElement).value).toBe('10')
    expect(api.fetchSchoolPupils).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'T4', classroomId: '10', page: 2 }),
    )
    await w.get('[data-testid="user-filter"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ level: 'T4', classroomId: '10' })
  })

  it('the pre-filter link /admin-sekolah/pelajar?classroomId={id} filters the list by that class alone', async () => {
    api.fetchSchoolClasses.mockResolvedValue(classPage([{ id: 10, name: '4 Amanah', levelLabel: 'Tingkatan 4' }]))
    const { wrapper: w } = await mountPupils(undefined, '/admin-sekolah/pelajar?classroomId=10')
    expect(api.fetchSchoolPupils).toHaveBeenCalledWith(expect.objectContaining({ level: null, classroomId: '10' }))
    expect((w.get('[data-testid="user-class-filter"]').element as HTMLSelectElement).value).toBe('10')
  })

  it('an invalid level or class in the URL is ignored', async () => {
    await mountPupils(undefined, '/admin-sekolah/pelajar?level=T9&classroomId=abc')
    expect(api.fetchSchoolPupils).toHaveBeenCalledWith(expect.objectContaining({ level: null, classroomId: null }))
  })

  it('"Eksport CSV" sends the Tingkatan and Kelas as they stand (FR-AS-51-5)', async () => {
    api.downloadPupilsCsv.mockResolvedValue({ blob: new Blob(['x']), filename: 'x.csv' })
    api.fetchSchoolClasses.mockResolvedValue(classPage([{ id: 10, name: '4 Amanah', levelLabel: 'Tingkatan 4' }]))
    const { wrapper: w } = await mountPupils(undefined, '/admin-sekolah/pelajar?classroomId=10&level=T4')
    await w.get('[data-testid="user-export"]').trigger('click')
    await flushPromises()
    expect(api.downloadPupilsCsv).toHaveBeenCalledWith({ isActive: null, search: null, level: 'T4', classroomId: '10' })
  })

  it('the teacher list has no Tingkatan or Kelas select and does not load classes', async () => {
    const { wrapper: w } = await mountTeachers()
    expect(w.find('[data-testid="user-level-filter"]').exists()).toBe(false)
    expect(w.find('[data-testid="user-class-filter"]').exists()).toBe(false)
    expect(api.fetchSchoolClasses).not.toHaveBeenCalled()
  })

  it('initialises the controls from the URL and sends the applied filters to the endpoint', async () => {
    const { wrapper: w } = await mountPupils(
      undefined,
      '/admin-sekolah/pelajar?is_active=1&search=%20amin%20',
    )
    expect((w.get('[data-testid="user-status-filter"]').element as HTMLSelectElement).value).toBe(
      '1',
    )
    expect((w.get('[data-testid="user-search"]').element as HTMLInputElement).value).toBe(' amin ')
    expect(api.fetchSchoolPupils).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, search: 'amin', page: 1 }),
    )
  })

  it('submitting the filter navigates with is_active and search, dropping the page', async () => {
    const { wrapper: w, router } = await mountPupils(undefined, '/admin-sekolah/pelajar?page=3')
    await w.get('[data-testid="user-status-filter"]').setValue('0')
    await w.get('[data-testid="user-search"]').setValue('  budi ')
    await w.get('[data-testid="user-filter"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/pelajar')
    expect(router.currentRoute.value.query).toEqual({ is_active: '0', search: 'budi' })
  })

  it('"Eksport CSV" sends the form values as they stand (Cari not pressed) and saves the file under the server name', async () => {
    api.downloadPupilsCsv.mockResolvedValue({
      blob: new Blob(['x']),
      filename: 'users-pelajar-2026-09-25.csv',
    })
    const { wrapper: w } = await mountPupils()
    await w.get('[data-testid="user-status-filter"]').setValue('1')
    await w.get('[data-testid="user-search"]').setValue('amin')
    await w.get('[data-testid="user-export"]').trigger('click')
    await flushPromises()
    expect(api.downloadPupilsCsv).toHaveBeenCalledWith({ isActive: '1', search: 'amin' })
    expect(save.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'users-pelajar-2026-09-25.csv')
  })

  it('"Eksport CSV" with empty controls sends no filter and falls back to a dated name', async () => {
    api.downloadPupilsCsv.mockResolvedValue({ blob: new Blob(['x']), filename: null })
    const { wrapper: w } = await mountPupils()
    await w.get('[data-testid="user-export"]').trigger('click')
    await flushPromises()
    expect(api.downloadPupilsCsv).toHaveBeenCalledWith({ isActive: null, search: null })
    expect(save.saveBlob.mock.calls[0]![1]).toMatch(/^users-pelajar-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('a failed export (500) shows the generic BM flash and saves nothing', async () => {
    api.downloadPupilsCsv.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Gagal.' }),
    )
    const { wrapper: w } = await mountPupils()
    await w.get('[data-testid="user-export"]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current).toEqual({
      type: 'error',
      message: ['Ralat berlaku. Sila cuba lagi.'],
    })
    expect(save.saveBlob).not.toHaveBeenCalled()
  })

  it('shows the 25-row pager only with more than one page, keeping the filters in the links', async () => {
    const { wrapper: w, router } = await mountPupils(
      list([pupil()], { totalItems: 60, totalPages: 3, to: 1 }),
      '/admin-sekolah/pelajar?is_active=1&search=a',
    )
    expect(text(w, 'user-table')).toContain('Menunjukkan 1-25 daripada 60 hasil')
    const next = w.findAll('[data-ds="data-table-pager"] button').find((b) => b.text() === '2')
    await next!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ is_active: '1', search: 'a', page: '2' })
  })

  it('renders the global 403 page for a 403 and the generic BM line for another failure', async () => {
    await mountPupils(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }))
    expect(useRouteOutcome().value).toBe(403)
    setRouteOutcome(null)
    const { wrapper: w } = await mountPupils(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }),
    )
    expect(text(w, 'user-error')).toContain('Ralat berlaku. Sila cuba lagi.')
    expect(has(w, 'user-table')).toBe(false)
  })

  it('shows "Menyamar" in every "Tindakan" cell (M27-T6, FR-M27-121)', async () => {
    const { wrapper: w } = await mountPupils()
    expect(w.findAll('[data-testid="user-impersonate"]')).toHaveLength(2)
    expect(w.findAll('[data-testid="user-actions"]')).toHaveLength(2)
  })
})

describe('S7 Senarai Guru (FR-M27-99 to 103)', () => {
  it('sets the header and shows the single card "Guru", the text and the two buttons', async () => {
    const { wrapper: w } = await mountTeachers()
    expect(usePageMeta().state.header).toEqual({
      title: 'Senarai Guru',
      subtitle: 'SMK Contoh Ujian',
    })
    expect(text(w, 'user-count-card')).toContain('Guru')
    expect(text(w, 'user-found')).toBe('2 pengguna dijumpai')
    expect(text(w, 'user-export')).toBe('Eksport CSV')
    const add = w.get('[data-testid="user-add"]')
    expect(add.text()).toBe('Cipta Pengguna')
    expect(add.attributes('href')).toBe('/admin-sekolah/guru/baru')
    expect(w.text()).not.toContain('Tambah Pelajar')
  })

  it('has the nine column heads in order', async () => {
    const { wrapper: w } = await mountTeachers()
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      '#',
      'Nama',
      'Emel',
      'Telefon',
      'Kelas',
      'Login Terakhir',
      'Aktif?',
      'Tarikh',
      'Tindakan',
    ])
  })

  it('shows Kelas, Telefon, Login Terakhir and the date under the name while their columns are hidden', async () => {
    await atWidth(768, async () => {
      const { wrapper: w } = await mountTeachers()
      const row = w.findAll('tbody tr')[0]!
      const sub = (k: string) => row.get(`[data-testid="user-sub-${k}"]`)
      expect(sub('kelas').text()).toBe('Kelas: 2 kelas')
      expect(sub('phone').text()).toMatch(/^Telefon: /)
      expect(sub('last-login').text()).toMatch(/^Login Terakhir: /)
      expect(sub('date').text()).toMatch(/^Tarikh: \d{2}\/\d{2}\/\d{4}$/)
      expect(row.find('[data-testid="user-sub-grade"]').exists()).toBe(false)
    })
    await atWidth(1536, async () => {
      const { wrapper: w } = await mountTeachers()
      const row = w.findAll('tbody tr')[0]!
      expect(row.find('[data-testid="user-sub-kelas"]').exists()).toBe(false)
      expect(row.find('[data-testid="user-sub-last-login"]').exists()).toBe(false)
      expect(row.get('[data-testid="user-sub-date"]').text()).toMatch(/^Tarikh: /)
    })
  })

  it('renders "{n} kelas", "Belum login", the active button and the edit link; an inactive teacher has none', async () => {
    const { wrapper: w } = await mountTeachers()
    const [a, b] = w.findAll('tbody tr')
    expect(a!.get('[data-testid="user-classes"]').text()).toBe('2 kelas')
    expect(a!.get('[data-testid="user-last-login"]').text()).toBe('Belum login')
    expect(a!.get('[data-testid="user-phone"]').text()).toBe('-')
    expect(a!.get('[data-testid="user-toggle"]').text()).toBe('Aktif')
    expect(a!.get('[data-testid="user-name"]').attributes('href')).toBe('/admin-sekolah/guru/5')
    expect(a!.get('[data-testid="user-edit"]').attributes('href')).toBe('/admin-sekolah/guru/5')
    expect(b!.get('[data-testid="user-classes"]').text()).toBe('-')
    expect(b!.get('[data-testid="user-last-login"]').text()).toMatch(/yang lepas$/)
    expect(b!.get('[data-testid="user-toggle"]').text()).toBe('Tidak')
    expect(b!.get('[data-testid="user-name"]').element.tagName).toBe('SPAN')
    expect(b!.find('[data-testid="user-edit"]').exists()).toBe(false)
  })

  const confirmWith = (answer: boolean) => vi.spyOn(window, 'confirm').mockReturnValue(answer)

  it('the "Aktif?" button asks the native confirm; cancel does nothing', async () => {
    const confirm = confirmWith(false)
    const { wrapper: w } = await mountTeachers()
    await w.get('[data-testid="user-toggle"]').trigger('click')
    expect(confirm).toHaveBeenCalledWith('Pasti untuk menukar status pengguna ini?')
    expect(api.toggleSchoolTeacherActive).not.toHaveBeenCalled()
  })

  it('accepting switches the teacher, reloads the list and flashes the server status', async () => {
    confirmWith(true)
    api.toggleSchoolTeacherActive.mockResolvedValue({
      data: { isActive: false },
      status: 'Status pengguna berjaya dikemaskini.',
    })
    const { wrapper: w } = await mountTeachers()
    expect(api.fetchSchoolTeachers).toHaveBeenCalledTimes(1)
    await w.get('[data-testid="user-toggle"]').trigger('click')
    await flushPromises()
    expect(api.toggleSchoolTeacherActive).toHaveBeenCalledWith(5)
    expect(api.fetchSchoolTeachers).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Status pengguna berjaya dikemaskini.',
    })
  })

  it('the inactive teacher button can switch back (the toggle is not blocked)', async () => {
    confirmWith(true)
    api.toggleSchoolTeacherActive.mockResolvedValue({ data: { isActive: true }, status: 'ok' })
    const { wrapper: w } = await mountTeachers()
    await w.findAll('[data-testid="user-toggle"]')[1]!.trigger('click')
    await flushPromises()
    expect(api.toggleSchoolTeacherActive).toHaveBeenCalledWith(6)
  })

  it('"Eksport CSV" uses the teacher export with the form values', async () => {
    api.downloadTeachersCsv.mockResolvedValue({
      blob: new Blob(['x']),
      filename: 'users-guru-2026-09-25.csv',
    })
    const { wrapper: w } = await mountTeachers()
    await w.get('[data-testid="user-search"]').setValue('guru')
    await w.get('[data-testid="user-export"]').trigger('click')
    await flushPromises()
    expect(api.downloadTeachersCsv).toHaveBeenCalledWith({ isActive: null, search: 'guru' })
    expect(api.downloadPupilsCsv).not.toHaveBeenCalled()
    expect(save.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'users-guru-2026-09-25.csv')
  })

  it('shows the empty row for a school without teachers', async () => {
    const { wrapper: w } = await mountTeachers(list([], {}, { total: 0, active: 0, inactive: 0 }))
    expect(text(w, 'user-empty')).toContain('Tiada pengguna dijumpai')
  })
})
