// @vitest-environment jsdom
import { useToast } from '@nuxt/ui/composables'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'

import type {
  MonitoringOverview,
  SchoolDetail,
  StudentAnswerRow,
  StudentDetail,
  TeacherDetail,
} from '../../api/types'
import { EXPORT_ERROR } from '../../components/monitoring/monitoring-format'
import MonitoringPage from '../../pages/MonitoringPage.vue'
import MonitoringSchoolPage from '../../pages/MonitoringSchoolPage.vue'
import MonitoringStudentPage from '../../pages/MonitoringStudentPage.vue'
import MonitoringTeacherPage from '../../pages/MonitoringTeacherPage.vue'

const api = vi.hoisted(() => ({
  fetchMonitoringOverview: vi.fn(),
  fetchSchoolDetail: vi.fn(),
  fetchStudentDetail: vi.fn(),
  fetchTeacherDetail: vi.fn(),
  fetchMonitoringExport: vi.fn(),
}))
vi.mock('../../api', () => api)

const saveBlob = vi.hoisted(() => vi.fn())
vi.mock('@/lib/save-blob', () => ({ saveBlob }))

// --- fixtures ---------------------------------------------------------------------------------

function overview(extra: Partial<MonitoringOverview> = {}): MonitoringOverview {
  return {
    filters: { period: '', state: '', tahap: '' },
    kpi: {
      schools: 57,
      students: 4158,
      engaged: 1462,
      engagementPct: 35.2,
      answers: 472371,
      avgPerStudent: 323.1,
      teachers: 522,
      teachersLoggedIn: 277,
      teacherPct: 53.1,
    },
    studentRows: [
      {
        schoolId: 940,
        name: 'SMK Satu',
        code: 'ABC1',
        state: 'Selangor',
        registered: 1,
        engaged: 1,
        pct: 100,
        tahap: 'Cemerlang',
      },
      {
        schoolId: 8087,
        name: 'SMK Dua',
        code: null,
        state: 'Johor',
        registered: 20,
        engaged: 3,
        pct: 15,
        tahap: 'Rendah',
      },
      {
        schoolId: 9000,
        name: 'SMK Tiga',
        code: 'T3',
        state: 'Johor',
        registered: 5,
        engaged: 0,
        pct: 0,
        tahap: 'Tiada Langsung',
      },
    ],
    teacherRows: [
      {
        schoolId: 940,
        name: 'SMK Satu',
        code: 'ABC1',
        state: 'Selangor',
        registered: 2,
        loggedIn: 2,
        pct: 100,
        tahap: 'Cemerlang',
      },
    ],
    weeks: [
      { k: 1, from: '16/02', to: '22/02' },
      { k: 2, from: '23/02', to: '01/03' },
    ],
    weekly: [
      {
        schoolId: 940,
        name: 'SMK Satu',
        code: 'ABC1',
        cells: [
          { k: 1, count: 0, cls: 'zero', best: false },
          { k: 2, count: 1234, cls: 'up', best: true },
        ],
        trend: 'up',
        best: { k: 2, count: 1234 },
      },
    ],
    signals: {
      best: [
        {
          schoolId: 940,
          name: 'SMK Satu',
          kind: 'best',
          registered: 1,
          engaged: 1,
          pct: 100,
          teachersLoggedIn: 2,
        },
      ],
      attention: [
        {
          schoolId: 8087,
          name: 'SMK Dua',
          kind: 'rendah',
          registered: 20,
          engaged: 3,
          pct: 15,
          teachersLoggedIn: 0,
        },
        {
          schoolId: 9000,
          name: 'SMK Tiga',
          kind: 'tiada',
          registered: 5,
          engaged: 0,
          pct: 0,
          teachersLoggedIn: 4,
        },
      ],
      suggestions: [
        {
          schoolId: 9000,
          name: 'SMK Tiga',
          kind: 'handsOn',
          registered: 5,
          engaged: 0,
          pct: 0,
          teachersLoggedIn: 4,
        },
      ],
    },
    ...extra,
  }
}

function school(extra: Partial<SchoolDetail> = {}): SchoolDetail {
  return {
    school: { id: 8080, name: 'SMK Contoh', code: 'KOD1', state: 'Selangor' },
    subscription: { status: 'active', endsAt: '2027-05-12T00:00:00+08:00' },
    warning: { review: 1, excluded: 1 },
    tahap: 'Cemerlang',
    pct: 89.7,
    cards: { students: 4, engaged: 2, answers: 53494, teachers: 2, teachersLoggedIn: 1 },
    flags: { review: 1, excluded: 1 },
    students: [
      {
        id: 1,
        name: 'Ali Demo',
        email: 'ali@demo.test',
        level: 'T4',
        answers: 10,
        status: 'aktif',
        engaged: true,
        flag: null,
        lastLoginAt: '2026-06-16T14:11:00+08:00',
        lastActivityAt: '2026-06-16T14:19:00+08:00',
      },
      {
        id: 2,
        name: "Nur'ain Demo",
        email: 'nur@demo.test',
        level: 'T5',
        answers: 40,
        status: 'aktif',
        engaged: false,
        flag: 'excluded',
        lastLoginAt: '2026-06-16T14:11:00+08:00',
        lastActivityAt: null,
      },
      {
        id: 3,
        name: 'Chong Demo',
        email: 'c@demo.test',
        level: 'T5',
        answers: 0,
        status: 'login',
        engaged: false,
        flag: 'review',
        lastLoginAt: '2026-06-10T10:00:00+08:00',
        lastActivityAt: null,
      },
      {
        id: 4,
        name: 'Dewi Demo',
        email: 'd@demo.test',
        level: 'T5',
        answers: 0,
        status: 'never',
        engaged: false,
        flag: null,
        lastLoginAt: null,
        lastActivityAt: null,
      },
    ],
    teachers: [
      {
        id: 11,
        name: 'Cikgu Satu',
        email: 'g1@demo.test',
        loggedIn: true,
        lastLoginAt: '2026-09-01T09:00:00+08:00',
        createdAt: '2026-01-05T09:00:00+08:00',
      },
      {
        id: 12,
        name: 'Cikgu Dua',
        email: 'g2@demo.test',
        loggedIn: false,
        lastLoginAt: null,
        createdAt: '2026-01-06T09:00:00+08:00',
      },
    ],
    ...extra,
  }
}

function answerRow(i: number, extra: Partial<StudentAnswerRow> = {}): StudentAnswerRow {
  return {
    questionId: 700400 + i,
    html: `<p>Soalan nombor ${String(i)}</p>`,
    textPlain: `Soalan nombor ${String(i)}`,
    subjectName: 'Sejarah',
    chapterLabel: 'Sejarah Tingkatan 5 KSSM',
    source: 'Percubaan SPM 2025',
    difficulty: 2,
    answeredAt: '2026-06-16T14:19:57+08:00',
    selectedLabel: 'A',
    correctLabel: 'D',
    isCorrect: false,
    options: [
      { label: 'A', text: 'I dan IV' },
      { label: 'B', text: 'II dan III' },
      { label: 'C', text: 'III dan IV' },
      { label: 'D', text: 'I dan II' },
    ],
    explanation: 'Penjelasan ringkas.',
    ...extra,
  }
}

function student(extra: Partial<StudentDetail> = {}): StudentDetail {
  const rows = Array.from({ length: 45 }, (_, i) => answerRow(i + 1))
  return {
    school: { id: 8080, name: 'SMK Contoh' },
    student: {
      id: 2008,
      name: 'Adam Demo',
      email: 'adam@demo.test',
      level: 'T5',
      lastActivityAt: '2026-06-16T14:19:00+08:00',
    },
    cards: { answered: 71, correct: 53, wrong: 18, accuracy: 74.6 },
    subjects: [
      { subjectId: 1, name: 'Bahasa Melayu', correct: 31, total: 31, pct: 100 },
      { subjectId: 2, name: 'Bahasa Inggeris', correct: 6, total: 15, pct: 40 },
    ],
    topics: [
      {
        subjectId: 1,
        subjectName: 'Bahasa Melayu',
        rows: [
          { bab: 3, name: 'Operasi Set', correct: 5, total: 5, pct: 100, badge: 'Kuat' },
          { bab: null, name: 'Umum', correct: 1, total: 4, pct: 25, badge: 'Lemah' },
        ],
      },
    ],
    answers: { available: 45, total: 45, rows },
    wrong: { count: 45, unique: 45, rows },
    gaps: {
      count: 1,
      items: [
        {
          group: 'Bab Lemah',
          subjectName: 'Sejarah',
          pct: 25,
          correct: 1,
          total: 4,
          severity: 'Kritikal',
          availableQuestions: 12,
        },
      ],
      strong: [{ group: 'Bab Kuat', subjectName: 'Sejarah', pct: 90, answered: 10 }],
      untried: ['Matematik'],
    },
    observations: [
      { kind: 'strong', subjectName: 'Bahasa Melayu', pct: 100, wrong: 0, total: 31 },
      { kind: 'weak', subjectName: 'Bahasa Inggeris', pct: 40, wrong: 9, total: 15 },
    ],
    ...extra,
  }
}

function teacher(extra: Partial<TeacherDetail> = {}): TeacherDetail {
  return {
    school: { id: 8080, name: 'SMK Contoh' },
    teacher: {
      id: 2012,
      name: 'Cikgu Tiga',
      email: 'g3@demo.test',
      lastLoginAt: '2026-09-20T08:00:00+08:00',
    },
    cards: { students: 3, engaged: 2, pct: 66.7, needAttention: 1 },
    students: [
      { id: 1, name: 'Ali Demo', level: 'T4', answers: 10, accuracy: 80, status: 'aktif' },
      { id: 2, name: 'Bella Demo', level: 'T5', answers: 20, accuracy: 45, status: 'aktif' },
      { id: 3, name: 'Chong Demo', level: 'T5', answers: 0, accuracy: null, status: 'login' },
    ],
    suggestions: { neverLoggedIn: 0, lowAccuracy: 1, answered: 2 },
    ...extra,
  }
}

// --- harness ---------------------------------------------------------------------------------

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(component: Component, path: string, props: Record<string, unknown> = {}) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(component, {
    props,
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

/** Dialog content mounts after a timer (reka presence). */
const settle = () => new Promise((r) => setTimeout(r, 80)).then(() => flushPromises())
const tid = (id: string) => wrapper?.find(`[data-testid="${id}"]`)
/** The i-th crumb of the `DsBreadcrumb` (the last one is plain text, FN-M11-1.1.3). */
const crumb = (i: number) => tid('mon-crumbs')?.findAll('[data-ds="breadcrumb-item"]')[i]
const all = (id: string) => wrapper?.findAll(`[data-testid="${id}"]`) ?? []
/** The big numbers of the `DsStatTile`s under a test id (the tile root, or a strip holding tiles). */
const valuesIn = (id: string) =>
  all(id)
    .flatMap((n) => (n.classes().includes('tabular') ? [n] : n.findAll('.tabular')))
    .map((n) => n.text())

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  setRouteOutcome(null)
  for (const fn of Object.values(api)) fn.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

// --- S2 -------------------------------------------------------------------------------------------

describe('S2 Monitoring Penglibatan', () => {
  beforeEach(() => {
    api.fetchMonitoringOverview.mockResolvedValue(overview())
  })

  it('renders KPIs with live formats and the two tables with prefix links', async () => {
    await mountAt(MonitoringPage, '/guru/monitoring', { basePath: '/guru/monitoring' })
    const values = valuesIn('mon-kpis')
    expect(values).toEqual([
      '57',
      '4,158',
      '1,462',
      '35.2%',
      '472,371',
      '323.1',
      '522',
      '277',
      '53.1%',
    ])
    expect(tid('mon-table-student')?.find('[data-testid="mon-table-count"]').text()).toBe(
      '3 sekolah',
    )
    expect(tid('mon-table-teacher')?.find('[data-testid="mon-table-count"]').text()).toBe(
      '1 sekolah',
    )
    const first = tid('mon-table-student')?.find('[data-testid="mon-school-link"]')
    expect(first?.attributes('href')).toBe('/guru/monitoring/sekolah/940')
    const rows = tid('mon-table-student')?.findAll('[data-testid="mon-table-row"]') ?? []
    expect(rows[1]?.text()).toContain('- · Johor')
    expect(tid('mon-table-student')?.text()).toContain('0%')
  })

  it('uses the prefix prop for every link (school-admin alias)', async () => {
    await mountAt(MonitoringPage, '/admin-sekolah/monitoring', {
      basePath: '/admin-sekolah/monitoring',
    })
    expect(tid('mon-school-link')?.attributes('href')).toBe('/admin-sekolah/monitoring/sekolah/940')
    expect(tid('mon-export-csv')?.attributes('href')).toBe('/admin-sekolah/monitoring/export/csv?')
  })

  it('weekly table: week heads with titles, cell classes, best ring, trend and best', async () => {
    await mountAt(MonitoringPage, '/guru/monitoring')
    const heads = all('mon-week-head')
    expect(heads.map((h) => h.text())).toEqual(['M1', 'M2'])
    expect(heads[0]?.attributes('title')).toBe('16/02 - 22/02')
    const cells = all('mon-weekly-cell')
    expect(cells[0]?.text()).toBe('-')
    expect(cells[1]?.text()).toBe('1,234')
    expect(cells[1]?.attributes('data-cls')).toBe('up')
    expect(cells[1]?.attributes('data-best')).toBe('true')
    expect(tid('mon-weekly-trend-icon')?.attributes('title')).toBe('Meningkat')
    expect(tid('mon-weekly-best')?.text().replace(/ {2,}/g, ' ')).toBe('M2 1,234')
    expect(tid('mon-week-footer')?.text()).toContain('M2: 23/02 - 01/03')
  })

  it('signals use the observed templates, the Nota suffix and the Cadangan tile', async () => {
    await mountAt(MonitoringPage, '/guru/monitoring')
    expect(tid('mon-best-item')?.text()).toBe('SMK Satu — 100% penglibatan (1/1 pelajar aktif)')
    const att = all('mon-attention-item').map((n) => n.text())
    expect(att[0]).toBe('SMK Dua — 3/20 pelajar aktif (15%). Tahap rendah.')
    expect(att[1]).toBe(
      'SMK Tiga — 5 pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebarang tanda penggunaan platform. (Nota: 4 guru telah login)',
    )
    expect(tid('mon-suggestion-item')?.text()).toBe(
      'SMK Tiga: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan pelajar.',
    )
  })

  it('all lists empty shows the single card', async () => {
    api.fetchMonitoringOverview.mockResolvedValue(
      overview({
        studentRows: [],
        teacherRows: [],
        weekly: [],
        signals: { best: [], attention: [], suggestions: [] },
      }),
    )
    await mountAt(MonitoringPage, '/guru/monitoring')
    expect(tid('mon-signals-empty')?.text()).toBe(
      'Tiada pemerhatian yang perlu diberi perhatian buat masa ini.',
    )
    expect(tid('mon-table-student')?.find('[data-testid="mon-table-count"]').text()).toBe(
      '0 sekolah',
    )
    expect(all('mon-table-row')).toHaveLength(0)
  })

  it('guide: shown by default, hide stores the key, show removes it', async () => {
    await mountAt(MonitoringPage, '/guru/monitoring')
    expect(tid('mon-guide')?.exists()).toBe(true)
    expect(all('mon-guide-tile')).toHaveLength(6)
    expect(tid('mon-guide-tip')?.text()).toContain('Guna Filter untuk tapis negeri/tempoh/tahap.')
    await tid('mon-guide-close')?.trigger('click')
    expect(window.localStorage.getItem('hideMonitoringGuide')).toBe('true')
    expect(tid('mon-guide')?.exists()).toBe(false)
    expect(tid('mon-guide-show')?.text()).toBe('Tunjuk panduan penggunaan')
    await tid('mon-guide-show')?.trigger('click')
    expect(window.localStorage.getItem('hideMonitoringGuide')).toBeNull()
    expect(tid('mon-guide')?.exists()).toBe(true)
  })

  it('guide starts hidden when the key is "true"', async () => {
    window.localStorage.setItem('hideMonitoringGuide', 'true')
    await mountAt(MonitoringPage, '/guru/monitoring')
    expect(tid('mon-guide')?.exists()).toBe(false)
    expect(tid('mon-guide-show')?.exists()).toBe(true)
  })

  it('filters: no Reset by default; Tapis navigates with the query and a dummy token; Reset then shows', async () => {
    await mountAt(MonitoringPage, '/guru/monitoring', { basePath: '/guru/monitoring' })
    expect(tid('active-filters-reset')?.exists()).toBe(false)
    await tid('mon-period')?.setValue('7d')
    await tid('mon-filters')?.trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/guru/monitoring')
    expect(router.currentRoute.value.query).toMatchObject({ period: '7d', state: '', tahap: '' })
    expect(typeof router.currentRoute.value.query._token).toBe('string')
    expect(api.fetchMonitoringOverview).toHaveBeenLastCalledWith(
      { period: '7d', state: '', tahap: '' },
      expect.anything(),
    )
    expect(tid('active-filters')?.text()).toContain('Tempoh: 7 Hari')
    await tid('active-filters-reset')?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/guru/monitoring')
    await router.push('/guru/monitoring?period=7d&state=&tahap=')
    await flushPromises()
    expect(tid('mon-export-pdf')?.attributes('href')).toBe('/guru/monitoring/export/pdf?period=7d')
  })

  it('Refresh with the same query reloads the data', async () => {
    await mountAt(MonitoringPage, '/guru/monitoring')
    const before = api.fetchMonitoringOverview.mock.calls.length
    await tid('mon-filters')?.trigger('submit')
    await flushPromises()
    await tid('mon-filters')?.trigger('submit')
    await flushPromises()
    expect(api.fetchMonitoringOverview.mock.calls.length).toBeGreaterThan(before + 1)
  })

  it('CSV export saves monitoring-penglibatan.csv with one line per row', async () => {
    api.fetchMonitoringExport.mockResolvedValue({
      filename: 'monitoring-penglibatan.csv',
      rows: overview().studentRows,
    })
    await mountAt(MonitoringPage, '/guru/monitoring')
    await tid('mon-export-csv')?.trigger('click')
    await flushPromises()
    expect(saveBlob).toHaveBeenCalledTimes(1)
    const [blob, name] = saveBlob.mock.calls[0] as [Blob, string]
    expect(name).toBe('monitoring-penglibatan.csv')
    expect(blob.size).toBeGreaterThan(0)
    expect(api.fetchMonitoringExport).toHaveBeenCalledWith('csv', {
      period: '',
      state: '',
      tahap: '',
    })
  })

  it('a failed CSV export shows the BM error toast (never the API text), saves nothing and does not throw (DV-M11-32)', async () => {
    useToast().clear()
    api.fetchMonitoringExport.mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'SERVER_ERROR',
        message: 'Backend exploded: secret detail',
      }),
    )
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    await mountAt(MonitoringPage, '/guru/monitoring')
    await tid('mon-export-csv')?.trigger('click')
    await flushPromises()
    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
    expect(saveBlob).not.toHaveBeenCalled()
    const titles = useToast().toasts.value.map((t) => t.title)
    expect(titles).toEqual([EXPORT_ERROR])
    expect(EXPORT_ERROR).toBe('Ralat berlaku. Sila cuba lagi.')
    expect(JSON.stringify(useToast().toasts.value)).not.toContain('Backend exploded')
  })

  it('shows the error copy when the fetch fails', async () => {
    api.fetchMonitoringOverview.mockRejectedValue(new Error('x'))
    await mountAt(MonitoringPage, '/guru/monitoring')
    expect(tid('mon-error')?.exists()).toBe(true)
  })
})

// --- S3 -------------------------------------------------------------------------------------------

describe('S3 Detail Sekolah', () => {
  beforeEach(() => {
    api.fetchSchoolDetail.mockResolvedValue(school())
  })

  it('header, cards, subscription pill and the two-sentence warning', async () => {
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/8080', { schoolId: 8080 })
    expect(tid('mon-school-name')?.text()).toBe('SMK Contoh')
    expect(tid('mon-school-tahap')?.text()).toBe('Cemerlang — 89.7%')
    expect(tid('mon-subscription')?.text()).toContain('Active — sehingga 12 May 2027')
    expect(valuesIn('mon-school-cards')).toEqual(['4', '2', '53,494', '2', '1'])
    expect(tid('mon-warning')?.text().replace(/ {2,}/g, ' ')).toBe(
      '⚠ 2 akaun menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak). 1 daripadanya dikecualikan dari peratus penglibatan kerana corak seperti automasi. Angka penglibatan di atas ialah nilai tulen selepas tapis.',
    )
    expect(crumb(0)?.find('a').attributes('href')).toBe('/guru/monitoring')
  })

  it('one-sentence warning when none is excluded; no box without flags; "Tiada langganan"', async () => {
    api.fetchSchoolDetail.mockResolvedValue(school({ warning: { review: 3, excluded: 0 } }))
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/8087', { schoolId: 8087 })
    expect(tid('mon-warning')?.text().replace(/ {2,}/g, ' ')).toBe(
      '⚠ 3 akaun menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak). Angka penglibatan di atas ialah nilai tulen selepas tapis.',
    )
    wrapper?.unmount()
    api.fetchSchoolDetail.mockResolvedValue(school({ warning: null, subscription: null }))
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/940', { schoolId: 940 })
    expect(tid('mon-warning')?.exists()).toBe(false)
    expect(tid('mon-subscription')?.text()).toBe('Tiada langganan')
  })

  it('cancelled and expired pills are neutral', async () => {
    api.fetchSchoolDetail.mockResolvedValue(
      school({ subscription: { status: 'expired', endsAt: '2026-05-22T00:00:00+08:00' } }),
    )
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/8107', { schoolId: 8107 })
    expect(tid('mon-subscription')?.text()).toContain('Expired — sehingga 22 May 2026')
    expect(tid('mon-subscription')?.attributes('data-status')).toBe('expired')
  })

  it('school-admin alias: a pupil without answers is plain text (no Kirkpatrick link)', async () => {
    await mountAt(MonitoringSchoolPage, '/admin-sekolah/monitoring/sekolah/8080', {
      schoolId: 8080,
      basePath: '/admin-sekolah/monitoring',
    })
    const rows = all('mon-student-row')
    expect(rows[0]?.find('a').attributes('href')).toBe(
      '/admin-sekolah/monitoring/sekolah/8080/pelajar/1',
    )
    expect(rows[3]?.find('a').exists()).toBe(false)
    expect(rows[3]?.text()).toContain('Dewi Demo')
  })

  it('pupil rows: link targets, faded rows, flags, status, "T{n}"', async () => {
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/8080', { schoolId: 8080 })
    const rows = all('mon-student-row')
    expect(rows).toHaveLength(4)
    expect(rows[0]?.find('a').attributes('href')).toBe('/guru/monitoring/sekolah/8080/pelajar/1')
    expect(rows[3]?.find('a').attributes('href')).toBe('/guru/kirkpatrick/pelajar/4')
    expect(rows[3]?.attributes('data-faded')).toBe('true')
    expect(rows[0]?.attributes('data-faded')).toBe('false')
    expect(rows[1]?.find('[data-testid="mon-flag"]').text()).toBe('⚠ Perlu Semak · ditapis')
    expect(rows[2]?.find('[data-testid="mon-flag"]').text()).toBe('⚠ Perlu Semak')
    expect(tid('mon-student-scroller')?.text()).toContain('T4')
    expect(all('mon-student-status').map((n) => n.text())).toEqual([
      'Aktif',
      'Aktif',
      'Login sahaja',
      'Belum login',
    ])
  })

  it('pills filter client-side; the Aktif pill shows the engaged pupils (DV-M11-21)', async () => {
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/8080', { schoolId: 8080 })
    expect(tid('mon-pill-all')?.text()).toBe('Semua (4)')
    expect(tid('mon-pill-active')?.text()).toBe('● Aktif (2)')
    await tid('mon-pill-active')?.trigger('click')
    expect(all('mon-student-row').map((r) => r.attributes('data-student-id'))).toEqual(['1'])
    await tid('mon-pill-login')?.trigger('click')
    expect(all('mon-student-row').map((r) => r.attributes('data-student-id'))).toEqual(['3'])
    await tid('mon-pill-never')?.trigger('click')
    expect(all('mon-student-row').map((r) => r.attributes('data-student-id'))).toEqual(['4'])
    await tid('mon-pill-all')?.trigger('click')
    expect(all('mon-student-row')).toHaveLength(4)
  })

  it('both S3 pill rows wrap instead of swiping (SRS §10, G5-M11 bug 10)', async () => {
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/8080', { schoolId: 8080 })
    for (const id of ['mon-student-pills', 'mon-teacher-pills']) {
      const row = tid(id)?.get('[data-ds="pill-nav"] > div') ?? tid(id)?.find('div')
      expect(row?.classes()).toContain('flex-wrap')
      expect(row?.classes()).not.toContain('overflow-x-auto')
    }
  })

  it('search combines with the pill and works for a name with an apostrophe (DV-M11-18)', async () => {
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/8080', { schoolId: 8080 })
    await tid('mon-student-search')?.setValue("nur'ain")
    expect(all('mon-student-row').map((r) => r.attributes('data-student-id'))).toEqual(['2'])
    await tid('mon-pill-never')?.trigger('click')
    expect(all('mon-student-row')).toHaveLength(0)
    expect(tid('mon-student-scroller')?.find('thead').exists()).toBe(true)
    await tid('mon-student-search')?.setValue('zzzz')
    await tid('mon-pill-all')?.trigger('click')
    expect(all('mon-student-row')).toHaveLength(0)
  })

  it('teacher list: pills, statuses, link to S5; no teachers shows the empty text', async () => {
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/8080', { schoolId: 8080 })
    expect(tid('mon-teachers')?.text()).toContain('Senarai Guru (2)')
    expect(all('mon-teacher-link')[0]?.attributes('href')).toBe(
      '/guru/monitoring/sekolah/8080/guru/11',
    )
    await tid('mon-tpill-never')?.trigger('click')
    expect(all('mon-teacher-row')).toHaveLength(1)
    expect(tid('mon-teacher-status')?.text()).toBe('Belum login')
    await tid('mon-tpill-login')?.trigger('click')
    expect(tid('mon-teacher-status')?.text()).toBe('Pernah login')
    wrapper?.unmount()
    api.fetchSchoolDetail.mockResolvedValue(school({ teachers: [] }))
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/940', { schoolId: 940 })
    expect(tid('mon-teachers')?.text()).toContain('Senarai Guru (0)')
    expect(tid('mon-teachers-empty')?.text()).toBe('Tiada guru berdaftar untuk sekolah ini.')
  })

  it('404 and 403 render the in-place error outcome and no page body', async () => {
    api.fetchSchoolDetail.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await mountAt(MonitoringSchoolPage, '/guru/monitoring/sekolah/99999', { schoolId: 99999 })
    expect(tid('mon-school-header')?.exists()).toBe(false)
    expect(tid('mon-crumbs')?.exists()).toBe(false)
    expect(document.title).toContain('404')
    wrapper?.unmount()
    api.fetchSchoolDetail.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    await mountAt(MonitoringSchoolPage, '/admin-sekolah/monitoring/sekolah/940', {
      schoolId: 940,
      basePath: '/admin-sekolah/monitoring',
    })
    expect(document.title).toContain('403')
  })
})

// --- S4 -------------------------------------------------------------------------------------------

describe('S4 Detail Pelajar', () => {
  beforeEach(() => {
    api.fetchStudentDetail.mockResolvedValue(student())
  })
  const open = () =>
    mountAt(MonitoringStudentPage, '/guru/monitoring/sekolah/8080/pelajar/2008', {
      schoolId: 8080,
      userId: 2008,
    })

  it('header, cards and the breadcrumb of the URL school', async () => {
    await open()
    expect(tid('mon-student-meta')?.text()).toBe('adam@demo.test · T5')
    expect(tid('mon-student-last')?.text()).toBe('Aktiviti Terakhir: 16/06/2026 14:19')
    expect(valuesIn('mon-student-cards')).toEqual(['71', '53', '18', '74.6%'])
    expect(crumb(1)?.find('a').attributes('href')).toBe('/guru/monitoring/sekolah/8080')
    expect(crumb(2)?.text()).toBe('Adam Demo')
    expect(all('mon-tab-chip').map((n) => n.text())).toEqual(['45', '1'])
  })

  it('exactly one panel at a time, default Mengikut Subjek, Pemerhatian always visible', async () => {
    await open()
    expect(tid('mon-panel-subject')?.exists()).toBe(true)
    expect(all('mon-subject-row')).toHaveLength(2)
    expect(all('mon-subject-bar')[1]?.attributes('data-band')).toBe('low')
    expect(all('mon-observation').map((n) => n.text())).toEqual([
      'Kekuatan dalam Bahasa Melayu (100.0% ketepatan). Boleh jadikan motivasi.',
      'Kerap salah dalam Bahasa Inggeris (9/15 salah = 40.0% ketepatan). Cadangan: Fokus latihan tambahan.',
    ])
    await tid('mon-tab-topic')?.trigger('click')
    expect(tid('mon-panel-subject')?.exists()).toBe(false)
    const topicRows = all('mon-topic-row')
    expect(topicRows[0]?.text()).toContain('Bab 3')
    expect(topicRows[1]?.text()).not.toContain('Bab')
    expect(tid('mon-panel-topic')?.text()).toContain('Kuat')
    expect(tid('mon-panel-topic')?.text()).toContain('Lemah')
    expect(tid('mon-observations')?.exists()).toBe(true)
    await tid('mon-tab-gaps')?.trigger('click')
    expect(tid('mon-panel-topic')?.exists()).toBe(false)
    expect(tid('mon-gap-severity')?.text()).toBe('Kritikal')
    expect(tid('mon-gap-card')?.text()).toContain('12 soalan tersedia untuk latihan')
    expect(tid('mon-observations')?.exists()).toBe(true)
  })

  it('Senarai Soalan: 20 rows, "Papar lagi 20" adds 20 until all shown, then no button', async () => {
    await open()
    await tid('mon-tab-list')?.trigger('click')
    expect(tid('mon-list-heading')?.text()).toBe('Senarai Soalan (45 tersedia daripada 45)')
    expect(all('mon-list-row')).toHaveLength(20)
    expect(tid('mon-list-more')?.text()).toBe('Papar lagi 20 (20/45)')
    await tid('mon-list-more')?.trigger('click')
    expect(all('mon-list-row')).toHaveLength(40)
    expect(tid('mon-list-more')?.text()).toBe('Papar lagi 20 (40/45)')
    await tid('mon-list-more')?.trigger('click')
    expect(all('mon-list-row')).toHaveLength(45)
    expect(tid('mon-list-more')?.exists()).toBe(false)
  })

  it('a row opens the modal; the options are marked; closes with the cross', async () => {
    await open()
    await tid('mon-tab-list')?.trigger('click')
    await all('mon-list-row')[0]?.trigger('click')
    await settle()
    const modal = () => document.body.querySelector('[data-testid="mon-modal"]')
    expect(modal()).not.toBeNull()
    expect(document.body.querySelector('[data-testid="mon-modal-result"]')?.textContent).toBe(
      'Salah',
    )
    expect(document.body.querySelector('[data-testid="mon-modal-time"]')?.textContent).toContain(
      '2026-06-16 14:19:57',
    )
    const options = Array.from(document.body.querySelectorAll('[data-testid="mon-modal-option"]'))
    expect(options).toHaveLength(4)
    expect(options[0]?.textContent).toContain('Jawapan Pelajar')
    expect(options[3]?.textContent).toContain('Jawapan Betul')
    expect(
      document.body.querySelector('[data-testid="mon-modal-explanation"]')?.textContent,
    ).toContain('Penjelasan')
    ;(document.body.querySelector('[data-testid="mon-modal-close"]') as HTMLElement).click()
    await settle()
    expect(modal()).toBeNull()
  })

  it('a question without options shows the deleted copy (FR-M11-71)', async () => {
    const rows = [answerRow(1, { options: [], explanation: null })]
    api.fetchStudentDetail.mockResolvedValue(
      student({ answers: { available: 1, total: 1, rows }, wrong: { count: 1, unique: 1, rows } }),
    )
    await open()
    await tid('mon-tab-list')?.trigger('click')
    await all('mon-list-row')[0]?.trigger('click')
    await settle()
    expect(
      document.body.querySelector('[data-testid="mon-modal-no-options"]')?.textContent?.trim(),
    ).toBe('Pilihan jawapan telah dipadam dari sistem.')
  })

  it('Jawapan Salah: heading and every card (no cap)', async () => {
    await open()
    await tid('mon-tab-wrong')?.trigger('click')
    expect(tid('mon-wrong-heading')?.text()).toBe('Jawapan Salah (45 jawapan, 45 soalan unik)')
    expect(all('mon-wrong-card')).toHaveLength(45)
    expect(all('mon-wrong-card')[0]?.text()).toContain('Sumber: Percubaan SPM 2025')
  })

  it('Gap panel empty state with the live copy, strong tiles and untried chips', async () => {
    api.fetchStudentDetail.mockResolvedValue(
      student({ gaps: { count: 0, items: [], strong: [], untried: ['Matematik', 'Sains'] } }),
    )
    await open()
    await tid('mon-tab-gaps')?.trigger('click')
    expect(tid('mon-gap-empty')?.text()).toContain('Tiada topik lemah dikesan!')
    expect(tid('mon-gap-empty')?.text()).toContain(
      'Semua topik yang dicuba mempunyai ketepatan melebihi 60%.',
    )
    expect(all('mon-untried-chip').map((n) => n.text())).toEqual(['Matematik', 'Sains'])
  })

  it('a pupil with 0 answers renders the FN-4.2.11 state (cards 0 and "0%")', async () => {
    api.fetchStudentDetail.mockResolvedValue(
      student({
        student: {
          id: 4664,
          name: 'Kosong Demo',
          email: 'k@demo.test',
          level: 'T5',
          lastActivityAt: null,
        },
        cards: { answered: 0, correct: 0, wrong: 0, accuracy: 0 },
        subjects: [],
        topics: [],
        answers: { available: 0, total: 0, rows: [] },
        wrong: { count: 0, unique: 0, rows: [] },
        gaps: { count: 0, items: [], strong: [], untried: ['Matematik'] },
        observations: [],
      }),
    )
    await mountAt(MonitoringStudentPage, '/guru/monitoring/sekolah/8080/pelajar/4664', {
      schoolId: 8080,
      userId: 4664,
    })
    expect(tid('mon-student-last')?.text()).toBe('Aktiviti Terakhir: -')
    expect(valuesIn('mon-student-cards')).toEqual(['0', '0', '0', '0%'])
    await tid('mon-tab-list')?.trigger('click')
    expect(tid('mon-list-heading')?.text()).toBe('Senarai Soalan (0 tersedia daripada 0)')
    expect(tid('mon-list-more')?.exists()).toBe(false)
    expect(all('mon-observation')).toHaveLength(0)
  })

  it('404 raises the in-place outcome', async () => {
    api.fetchStudentDetail.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await open()
    expect(tid('mon-student-header')?.exists()).toBe(false)
    expect(document.title).toContain('404')
  })
})

// --- S5 -------------------------------------------------------------------------------------------

describe('S5 Detail Guru', () => {
  beforeEach(() => {
    api.fetchTeacherDetail.mockResolvedValue(teacher())
  })
  const open = () =>
    mountAt(MonitoringTeacherPage, '/guru/monitoring/sekolah/8080/guru/2012', {
      schoolId: 8080,
      userId: 2012,
    })

  it('header, cards, student table and the three suggestions', async () => {
    await open()
    expect(tid('mon-teacher-last')?.text()).toBe('Login Terakhir: 20/09/2026 08:00')
    expect(tid('mon-teacher-pill')?.text()).toBe('Pernah Login')
    expect(valuesIn('mon-teacher-cards')).toEqual(['3', '2', '66.7%', '1'])
    const rows = all('mon-teacher-student-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]?.find('a').attributes('href')).toBe('/guru/monitoring/sekolah/8080/pelajar/1')
    expect(rows[2]?.find('a').exists()).toBe(false)
    expect(rows[2]?.attributes('data-faded')).toBe('true')
    expect(all('mon-teacher-accuracy').map((n) => n.text())).toEqual(['80%', '45%', '-'])
    expect(tid('mon-suggestion-never')?.exists()).toBe(false)
    expect(tid('mon-suggestion-low')?.text()).toBe(
      '1 pelajar aktif mempunyai ketepatan bawah 50%. Cadangan: Beri perhatian khas kepada pelajar ini.',
    )
    expect(tid('mon-suggestion-answered')?.text()).toBe(
      '2 pelajar telah mula menjawab soalan. Galakkan mereka kekalkan momentum.',
    )
  })

  it('a teacher who never logged in: "Login Terakhir: -" and "Belum Login"', async () => {
    api.fetchTeacherDetail.mockResolvedValue(
      teacher({
        teacher: { id: 9, name: 'Cikgu Baru', email: 'b@demo.test', lastLoginAt: null },
        suggestions: { neverLoggedIn: 8, lowAccuracy: 0, answered: 0 },
      }),
    )
    await open()
    expect(tid('mon-teacher-last')?.text()).toBe('Login Terakhir: -')
    expect(tid('mon-teacher-pill')?.text()).toBe('Belum Login')
    expect(tid('mon-suggestion-never')?.text()).toContain(
      '8 pelajar belum pernah login. Cadangan: Adakan sesi pengenalan platform di kelas.',
    )
    expect(tid('mon-suggestion-low')?.exists()).toBe(false)
    expect(tid('mon-suggestion-answered')?.exists()).toBe(false)
  })
})
