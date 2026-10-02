// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router'
import { setRouteOutcome } from '@/app/router/outcome'

import type {
  ClassItemAnalysis,
  LevelDetail,
  SchoolItemAnalysis,
  SchoolPerformance,
} from '../../api/types'
import AnalisaItemKelasPage from '../../pages/AnalisaItemKelasPage.vue'
import AnalisaItemSekolahPage from '../../pages/AnalisaItemSekolahPage.vue'
import AnalisaItemKelasPilihPage from '../../pages/AnalisaItemKelasPilihPage.vue'
import TingkatanPilihPage from '../../pages/TingkatanPilihPage.vue'
import PrestasiKelasPilihPage from '../../pages/PrestasiKelasPilihPage.vue'
import PrestasiSekolahPage from '../../pages/PrestasiSekolahPage.vue'
import TingkatanPage from '../../pages/TingkatanPage.vue'

const api = vi.hoisted(() => ({
  fetchSchoolPerformance: vi.fn(),
  fetchLevels: vi.fn(),
  fetchLevelDetail: vi.fn(),
  fetchOwnClasses: vi.fn(),
  fetchSchoolItemAnalysis: vi.fn(),
  fetchItemAnalysisClasses: vi.fn(),
  fetchClassItemAnalysis: vi.fn(),
}))
vi.mock('../../api/performance', () => api)

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const

const S1: SchoolPerformance = {
  scope: 'platform',
  header: { classCount: 750, studentCount: 4533 },
  stats: {
    students: 4533,
    teachers: 551,
    classes: 750,
    subjects: 27,
    sessions: 32122,
    answered: 478499,
    accuracy: 79.8,
  },
  gps: { value: null, band: null, entries: 0 },
  distribution: GRADES.map((grade) => ({ grade, count: 0, pct: 0 })),
  trend: {
    years: [
      {
        year: 2022,
        gps: 5.2,
        band: 'Sederhana',
        candidates: 150,
        source: 'SPM Sebenar',
        change: null,
        current: false,
      },
      {
        year: 2023,
        gps: 4.8,
        band: 'Sederhana',
        candidates: 160,
        source: 'SPM Sebenar',
        change: -0.4,
        current: false,
      },
      {
        year: 2026,
        gps: null,
        band: null,
        candidates: null,
        source: null,
        change: null,
        current: true,
      },
    ],
    chart: { labels: [2022, 2023, 2026], overall: [5.2, 4.8, null], subjects: [] },
  },
  subjects: [
    {
      subjectId: 2,
      name: 'Perniagaan',
      gps: null,
      grade: null,
      entries: 0,
      onTrack: 0,
      below: 0,
      noTarget: 0,
      achievementPct: null,
    },
    {
      subjectId: 1,
      name: 'Ekonomi',
      gps: 1.86,
      grade: 'A-',
      entries: 28,
      onTrack: 9,
      below: 7,
      noTarget: 12,
      achievementPct: 80,
    },
  ],
  levels: [{ code: 't4', accuracy: 63.9, classes: 13, students: 149, sessions: 11 }],
  teachers: [
    {
      userId: 7,
      name: 'Cikgu Demo 7',
      classCount: 2,
      studentCount: 30,
      accuracy: 72.5,
      onTrack: null,
      below: null,
    },
  ],
}

let wrapper: VueWrapper | null = null

async function render(component: object, path: string, route = path.replace(/\?.*/, '')) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route === path ? path : route, component })
  await router.push(path)
  wrapper = mount(component, {
    global: {
      plugins: [router],
      stubs: { ChartCanvas: { template: '<div data-testid="chart" />' } },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const fn of Object.values(api)) fn.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('S1 PrestasiSekolahPage', () => {
  it('shows the stat cards, with only "Soalan Dijawab" grouped and the accuracy to 1 decimal', async () => {
    api.fetchSchoolPerformance.mockResolvedValue(S1)
    const w = await render(PrestasiSekolahPage, '/prestasi/sekolah')
    expect(t(w, 'header-summary').text()).toBe(
      'Ringkasan prestasi keseluruhan · 750 kelas · 4533 murid',
    )
    const values = w.findAll('[data-testid=stat-value]').map((v) => v.text())
    expect(values).toEqual(['4533', '551', '750', '27', '32122', '478,499', '79.8%'])
  })

  it('shows "—" and no band pill without headcount GPS, never 0', async () => {
    api.fetchSchoolPerformance.mockResolvedValue(S1)
    const w = await render(PrestasiSekolahPage, '/prestasi/sekolah')
    expect(t(w, 'gps-value').text()).toBe('—')
    expect(w.find('[data-testid=gps-band]').exists()).toBe(false)
    expect(t(w, 'grade-total').text()).toBe('Jumlah: 0 rekod')
    expect(t(w, 'teacher-7').text()).toContain('Tiada data headcount')
  })

  it('shows the GPS pill by band when entries exist', async () => {
    api.fetchSchoolPerformance.mockResolvedValue({
      ...S1,
      gps: { value: 3.45, band: 'Baik', entries: 744 },
    })
    const w = await render(PrestasiSekolahPage, '/prestasi/sekolah')
    expect(t(w, 'gps-value').text()).toBe('3.45')
    expect(t(w, 'gps-band').text()).toBe('Baik')
    expect(t(w, 'gps-entries').text()).toBe('744')
  })

  it('lists subject rows by GPS ascending, rows without data last, and the trend table rows', async () => {
    api.fetchSchoolPerformance.mockResolvedValue(S1)
    const w = await render(PrestasiSekolahPage, '/prestasi/sekolah')
    const rows = w.findAll('[data-testid=subject-table] tbody tr')
    expect(rows[0]?.text()).toContain('Ekonomi')
    expect(rows[1]?.text()).toContain('Perniagaan')
    expect(rows[1]?.text()).toContain('—')
    expect(t(w, 'trend-row-2023').text()).toContain('▼ 0.40')
    expect(t(w, 'trend-row-2026').text()).toContain('Semasa')
    expect(t(w, 'trend-row-2026').text()).toContain('Tiada data')
  })

  it('shows the load-error box with a retry button', async () => {
    api.fetchSchoolPerformance.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await render(PrestasiSekolahPage, '/prestasi/sekolah')
    expect(t(w, 'page-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    expect(t(w, 'page-error').text()).toContain('Cuba Semula')
  })
})

describe('S3 TingkatanPage', () => {
  const T4: LevelDetail = {
    code: 't4',
    name: 'Tingkatan 4',
    classes: 13,
    students: 149,
    subjects: 5,
    accuracy: 63.9,
    sessions: 11,
    onTrack: 0,
    below: 0,
    onTrackPct: 0,
    classRows: [
      {
        classId: 5,
        kind: 'classroom',
        name: '4 Cemerlang - BM',
        subject: 'Bahasa Melayu',
        teacher: 'Guru Demo',
        students: 53,
        sessions: 7,
        accuracy: 51.3,
        onTrack: 0,
        below: 0,
        href: '/prestasi/kelas/5',
      },
      {
        classId: 806,
        kind: 'school_class',
        name: 'T4 4 Khawarizmi',
        subject: 'Kelas Sekolah',
        teacher: null,
        students: 1,
        sessions: 0,
        accuracy: 0,
        onTrack: 0,
        below: 0,
        href: null,
      },
    ],
    topStudents: [
      { userId: 82, name: 'Pelajar Demo 000082', sessions: 4, answered: 60, accuracy: 64 },
    ],
    atRisk: [
      {
        userId: 3201,
        name: 'Murid Simulasi 01',
        className: '4 Simulasi',
        checkpoint: 3,
        ar: 56,
        target: 82,
        gap: -26,
      },
    ],
  }

  it('renders the cards, the class table without a link on school classes, and the lists', async () => {
    api.fetchLevelDetail.mockResolvedValue(T4)
    const w = await render(TingkatanPage, '/prestasi/tingkatan/t4', '/prestasi/tingkatan/:code')
    expect(api.fetchLevelDetail.mock.calls[0]?.[0]).toBe('t4')
    expect(t(w, 'level-summary').text()).toBe('Dashboard Prestasi Tingkatan · 13 kelas · 5 subjek')
    expect(t(w, 'stat-ketepatan').text()).toContain('63.9%')
    expect(t(w, 'headcount-pct').text()).toBe('0% On Track')
    expect(t(w, 'class-row-5').text()).toContain('Lihat →')
    expect(t(w, 'class-row-806').text()).not.toContain('Lihat')
    expect(t(w, 'class-row-806').text()).toContain('—')
    expect(t(w, 'top-82').text()).toContain('4 sesi · 60 soalan')
    expect(t(w, 'top-82').text()).toContain('64%')
    expect(t(w, 'at-risk').text()).toContain('4 Simulasi · OTR3: 56.00% (sasaran 82.00%)')
    expect(t(w, 'at-risk').text()).toContain('-26')
  })

  it('an unknown level code is the 404 page', async () => {
    api.fetchLevelDetail.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(TingkatanPage, '/prestasi/tingkatan/t9', '/prestasi/tingkatan/:code')
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('S4 PrestasiKelasPilihPage', () => {
  it('shows the observed empty state with the "Cipta Kelas" link', async () => {
    api.fetchOwnClasses.mockResolvedValue([])
    const w = await render(PrestasiKelasPilihPage, '/prestasi/kelas')
    expect(t(w, 'kelas-empty').text()).toContain('Anda belum mempunyai kelas aktif.')
    expect(t(w, 'kelas-create').attributes('href')).toBe('/guru/kelas/cipta')
  })

  it('lists active classes as cards linking to the class dashboard', async () => {
    api.fetchOwnClasses.mockResolvedValue([
      {
        id: 9,
        name: '5 A',
        subjectName: 'Kimia',
        color: '#10B981',
        students: 8,
        year: 2026,
        joinCode: 'ABC123',
        isActive: true,
      },
    ])
    const w = await render(PrestasiKelasPilihPage, '/prestasi/kelas')
    expect(t(w, 'class-card-9').attributes('href')).toBe('/prestasi/kelas/9')
    expect(w.find('[data-testid=kelas-empty]').exists()).toBe(false)
  })
})

describe('S9 AnalisaItemSekolahPage', () => {
  const BASE: SchoolItemAnalysis = {
    school: {
      id: 8880,
      name: 'SMK Demo Tinggi',
      code: 'JEB2037',
      type: 'SMK',
      district: 'PPD KLUANG',
      state: 'Johor',
    },
    variant: 'byId',
    tingkatan: null,
    students: 59,
    answers: 10194,
    correct: 7309,
    accuracy: 71.7,
    difficulty: { mudah: 0, sederhana: 0, sukar: 2 },
    gps: { value: null, band: null, entries: 0, years: [{ year: 2022, gps: 5.2 }] },
    subjects: [
      { subjectId: 4, name: 'Sains', pupils: 29, questions: 1094, accuracy: 70.9, wrong: 539 },
    ],
    questions: [
      {
        rank: 1,
        questionId: 1,
        stem: 'Soalan A',
        subjectName: 'Sains',
        chips: ['Tekanan'],
        level: 'Sukar',
        wrongPct: 100,
        attempts: 2,
        pupils: 2,
        pupilsPct: 3.4,
        wrongPupils: [
          { userId: 3201, name: 'Murid Simulasi 01', classLabel: '4 Simulasi', wrongOption: 'B' },
        ],
        correctOption: { letter: 'A', text: 'betul' },
        popularWrongOption: { letter: 'B', text: 'salah' },
        popularWrongCount: 1,
      },
      {
        rank: 2,
        questionId: 2,
        stem: 'Soalan B',
        subjectName: 'Matematik',
        chips: [],
        level: 'Sukar',
        wrongPct: 80,
        attempts: 5,
        pupils: 5,
        pupilsPct: 8.5,
        wrongPupils: [],
        correctOption: { letter: 'C', text: 'c' },
        popularWrongOption: null,
        popularWrongCount: 0,
      },
    ],
  }

  it('renders the school card, the stat cards and filters questions client-side', async () => {
    api.fetchSchoolItemAnalysis.mockResolvedValue(BASE)
    const w = await render(
      AnalisaItemSekolahPage,
      '/analisa-item/sekolah/8880',
      '/analisa-item/sekolah/:id',
    )
    expect(t(w, 'school-name').text()).toBe('SMK Demo Tinggi')
    expect(t(w, 'school-answers').text()).toBe('10,194')
    expect(t(w, 'stat-ketepatan').text()).toContain('71.7%')
    expect(t(w, 'diff-sukar').text()).toContain('2')
    expect(w.findAll('[data-testid^=question-][data-testid$="1"]').length).toBeGreaterThan(0)
    // Pills are alphabetical (live), not in order of first appearance (Sains comes first in the data).
    expect(w.findAll('[data-testid=question-filters] button').map((b) => b.text())).toEqual([
      'Semua (2)',
      'Matematik (1)',
      'Sains (1)',
    ])
    await t(w, 'filter-Matematik').trigger('click')
    expect(w.find('[data-testid=question-1]').exists()).toBe(false)
    expect(w.find('[data-testid=question-2]').exists()).toBe(true)
    await t(w, 'filter-all').trigger('click')
    await t(w, 'question-toggle-1').trigger('click')
    expect(t(w, 'question-detail-1').text()).toContain('Jawapan Salah Paling Popular (1x dipilih)')
    expect(t(w, 'question-detail-1').text()).toContain('Murid Simulasi 01')
  })

  it('shows "—", never 0, for the headline figures that have no observed header', async () => {
    api.fetchSchoolItemAnalysis.mockResolvedValue({
      ...BASE,
      answers: null,
      correct: null,
      accuracy: null,
    })
    const w = await render(
      AnalisaItemSekolahPage,
      '/analisa-item/sekolah/8880',
      '/analisa-item/sekolah/:id',
    )
    expect(t(w, 'school-answers').text()).toBe('—')
    expect(t(w, 'stat-soalan').text()).toContain('—')
    expect(t(w, 'stat-ketepatan').text()).toContain('—')
  })

  it('shows the own-school empty copy and the by-id copy for a school without pupils', async () => {
    api.fetchSchoolItemAnalysis.mockResolvedValue({
      ...BASE,
      variant: 'own',
      students: 0,
      answers: 0,
      questions: [],
      subjects: [],
    })
    let w = await render(AnalisaItemSekolahPage, '/analisa-item/sekolah')
    expect(t(w, 'school-empty').text()).toContain('menjawab soalan latihan.')
    w.unmount()
    api.fetchSchoolItemAnalysis.mockResolvedValue({
      ...BASE,
      variant: 'byId',
      students: 0,
      answers: 0,
      questions: [],
      subjects: [],
    })
    w = await render(
      AnalisaItemSekolahPage,
      '/analisa-item/sekolah/900002',
      '/analisa-item/sekolah/:id',
    )
    expect(t(w, 'school-empty').text()).toContain('Tiada Data Pelajar')
    expect(t(w, 'school-empty').text()).not.toContain('latihan.')
  })

  it('an unknown tingkatan value activates no chip and sends no filter', async () => {
    api.fetchSchoolItemAnalysis.mockResolvedValue(BASE)
    await render(
      AnalisaItemSekolahPage,
      '/analisa-item/sekolah?tingkatan=T9',
      '/analisa-item/sekolah',
    )
    expect(api.fetchSchoolItemAnalysis.mock.calls[0]?.[0]).toMatchObject({ tingkatan: null })
  })

  it('a 403 is the 403 page', async () => {
    api.fetchSchoolItemAnalysis.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    await render(AnalisaItemSekolahPage, '/analisa-item/sekolah/1', '/analisa-item/sekolah/:id')
    expect(useRouteOutcome().value).toBe(403)
  })
})

describe('S11 AnalisaItemKelasPage', () => {
  const diff = (id: number, index: number, accuracy: number, text: string) => ({
    questionId: id,
    text,
    subject: 'Kimia',
    topic: null,
    subtopic: null,
    attempts: 8,
    students: 8,
    accuracy,
    index,
    level: 'Sederhana' as const,
    wrongStudents: [{ userId: 3001, name: 'Murid Demo 01', times: 2 }],
    correctOption: { letter: 'B' as const, text: 'betul' },
    popularWrong: { letter: 'C' as const, text: 'salah', times: 3 },
  })
  const CLASS: ClassItemAnalysis = {
    class: {
      id: 2001,
      name: '5 MARIKH - Kimia',
      subjectName: 'Kimia',
      levelSlug: 'tingkatan-5',
      year: 2026,
      students: 8,
    },
    analysis: {
      questionCount: 8,
      summary: { mudah: 1, sederhana: 4, sukar: 3 },
      difficulty: [diff(1, 0.25, 75, 'Alpha'), diff(2, 0.88, 12.5, 'Beta')],
      discrimination: { sufficient: false, rows: [] },
    },
  }

  beforeEach(() => {
    api.fetchItemAnalysisClasses.mockResolvedValue([
      {
        id: 2001,
        name: '5 MARIKH - Kimia',
        subjectName: 'Kimia',
        color: '#000000',
        students: 8,
        year: 2026,
        joinCode: 'DMO101',
        isActive: true,
      },
    ])
  })

  it('shows the summary percentages, defaults to hardest first and toggles a detail row', async () => {
    api.fetchClassItemAnalysis.mockResolvedValue(CLASS)
    const w = await render(
      AnalisaItemKelasPage,
      '/analisa-item/kelas/2001',
      '/analisa-item/kelas/:id',
    )
    expect(t(w, 'summary-mudah').text()).toContain('13% daripada soalan')
    expect(t(w, 'summary-sukar').text()).toContain('38% daripada soalan')
    const rows = w.findAll('[data-testid^=difficulty-row-]')
    expect(rows.map((r) => r.attributes('data-testid'))).toEqual([
      'difficulty-row-2',
      'difficulty-row-1',
    ])
    await rows[0]?.trigger('click')
    expect(t(w, 'difficulty-detail-2').text()).toContain('Jawapan Salah Popular (3x dipilih)')
    expect(t(w, 'difficulty-detail-2').text()).toContain('2x salah')
    await rows[0]?.trigger('click')
    expect(w.find('[data-testid=difficulty-detail-2]').exists()).toBe(false)
  })

  it('filters by the search text and re-sorts, with no message when nothing matches', async () => {
    api.fetchClassItemAnalysis.mockResolvedValue(CLASS)
    const w = await render(
      AnalisaItemKelasPage,
      '/analisa-item/kelas/2001',
      '/analisa-item/kelas/:id',
    )
    await t(w, 'difficulty-search').setValue('alp')
    expect(w.findAll('[data-testid^=difficulty-row-]')).toHaveLength(1)
    await t(w, 'difficulty-search').setValue('zzz')
    expect(w.findAll('[data-testid^=difficulty-row-]')).toHaveLength(0)
    await t(w, 'difficulty-search').setValue('')
    await t(w, 'difficulty-sort').setValue('difficulty_asc')
    expect(w.findAll('[data-testid^=difficulty-row-]')[0]?.attributes('data-testid')).toBe(
      'difficulty-row-1',
    )
  })

  it('shows "Data Tidak Mencukupi" on the discrimination tab and the Tukar Kelas chips', async () => {
    api.fetchClassItemAnalysis.mockResolvedValue(CLASS)
    const w = await render(
      AnalisaItemKelasPage,
      '/analisa-item/kelas/2001',
      '/analisa-item/kelas/:id',
    )
    await t(w, 'tab-discrimination').trigger('click')
    expect(t(w, 'discrimination-insufficient').text()).toContain('Data Tidak Mencukupi')
    expect(t(w, 'switch-2001').attributes('href')).toBe('/analisa-item/kelas/2001')
  })

  it('shows "Tiada Data Lagi" and hides the percentages for a class without answers', async () => {
    api.fetchClassItemAnalysis.mockResolvedValue({
      ...CLASS,
      analysis: {
        ...CLASS.analysis,
        questionCount: 0,
        summary: { mudah: 0, sederhana: 0, sukar: 0 },
        difficulty: [],
      },
    })
    const w = await render(AnalisaItemKelasPage, '/analisa-item/kelas/6', '/analisa-item/kelas/:id')
    expect(t(w, 'difficulty-empty').text()).toContain('Tiada Data Lagi')
    expect(w.find('[data-testid=summary-pct]').exists()).toBe(false)
  })

  it('an unknown or forbidden class is the 403 page', async () => {
    api.fetchClassItemAnalysis.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    await render(AnalisaItemKelasPage, '/analisa-item/kelas/99999', '/analisa-item/kelas/:id')
    expect(useRouteOutcome().value).toBe(403)
  })
})

describe('S2 TingkatanPilihPage', () => {
  it('shows the two level cards with plain counts and the links', async () => {
    api.fetchLevels.mockResolvedValue([
      { code: 't4', name: 'Tingkatan 4', classes: 13, students: 149 },
      { code: 't5', name: 'Tingkatan 5', classes: 645, students: 3911 },
    ])
    const w = await render(TingkatanPilihPage, '/prestasi/tingkatan')
    expect(t(w, 'level-link-t4').text()).toContain('Tingkatan 4')
    expect(t(w, 'level-link-t4').text()).toContain('13 kelas | 149 murid')
    expect(t(w, 'level-link-t5').text()).toContain('645 kelas | 3911 murid')
    expect(t(w, 'level-link-t5').attributes('href')).toBe('/prestasi/tingkatan/t5')
  })

  it('shows the load-error box with a retry', async () => {
    api.fetchLevels.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await render(TingkatanPilihPage, '/prestasi/tingkatan')
    expect(t(w, 'page-error').text()).toContain('Cuba Semula')
  })
})

describe('S10 AnalisaItemKelasPilihPage', () => {
  it('lists a card per class with its colours, active dot, count and code, linking to S11', async () => {
    api.fetchItemAnalysisClasses.mockResolvedValue([
      {
        id: 1156,
        name: '5 CYBER',
        subjectName: 'Sains Rumah Tangga',
        color: '#10B981',
        students: 1,
        year: 2026,
        joinCode: 'JOV330',
        isActive: true,
      },
      {
        id: 1155,
        name: 'lama',
        subjectName: null,
        color: '#6366F1',
        students: 0,
        year: 2025,
        joinCode: '0VV295',
        isActive: false,
      },
    ])
    const w = await render(AnalisaItemKelasPilihPage, '/analisa-item/kelas')
    expect(w.text()).toContain('Pilih Kelas untuk Analisis')
    expect(w.text()).toContain('Klik mana-mana kelas untuk melihat analisa item')
    const cards = w.findAll('[data-testid=class-grid] > a')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.attributes('href')).toBe('/analisa-item/kelas/1156')
    expect(cards[0]?.text()).toContain('1 pelajar')
    expect(cards[0]?.text()).toContain('JOV330')
    expect(cards[0]?.text()).toContain('Lihat Analisa')
    expect(cards[0]?.find('[title=Aktif]').exists()).toBe(true)
    expect(cards[1]?.find('[title=Aktif]').exists()).toBe(false)
    expect(cards[0]?.attributes('style')).toContain('border-color')
  })
})

describe('S9 unknown school id', () => {
  it('shows only the by-id empty state, no school card', async () => {
    api.fetchSchoolItemAnalysis.mockResolvedValue({
      school: { id: 999999, name: '', code: null, type: '', district: null, state: '' },
      variant: 'byId',
      tingkatan: null,
      students: 0,
      answers: 0,
      correct: 0,
      accuracy: 0,
      difficulty: { mudah: 0, sederhana: 0, sukar: 0 },
      gps: { value: null, band: null, entries: 0, years: [] },
      subjects: [],
      questions: [],
    })
    const w = await render(
      AnalisaItemSekolahPage,
      '/analisa-item/sekolah/999999',
      '/analisa-item/sekolah/:id',
    )
    expect(w.find('[data-testid=school-card]').exists()).toBe(false)
    expect(t(w, 'school-empty').text()).toContain('Tiada Data Pelajar')
    expect(t(w, 'school-empty').text()).toContain('menjawab soalan.')
    expect(useRouteOutcome().value).toBeNull()
  })
})
