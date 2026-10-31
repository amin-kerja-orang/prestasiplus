// @vitest-environment jsdom
/**
 * M17-T3a component tests: S4-S7 (FR-M17-48..60) against a mocked client. Structure, exact BM copy,
 * links under the `basePath` prop (admin, M10 and Admin Sekolah mounts) and the modals. Observed figures
 * that depend on the pending M05 anchors are not asserted here (TODO XR-M17-02; the E2E smoke covers the
 * data-driven values).
 */
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'

import type {
  CcClass,
  CcHeadcountDetail,
  CcSchool,
  CcSessionDetail,
  CcSessionList,
  CcStudent,
  CcTeacher,
} from '../../api/command-center-types'
import CommandCenterClassPage from '../../pages/CommandCenterClassPage.vue'
import CommandCenterSchoolPage from '../../pages/CommandCenterSchoolPage.vue'
import CommandCenterStudentPage from '../../pages/CommandCenterStudentPage.vue'
import CommandCenterTeacherPage from '../../pages/CommandCenterTeacherPage.vue'
import { commandCenterDrillRoutes } from '../../routes/command-center'

const api = vi.hoisted(() => ({
  fetchCcSchool: vi.fn(),
  fetchCcTeacher: vi.fn(),
  fetchCcClass: vi.fn(),
  fetchCcStudent: vi.fn(),
  fetchCcStudentWeek: vi.fn(),
  fetchCcStudentAllSessions: vi.fn(),
  fetchCcStudentSubject: vi.fn(),
  fetchCcSession: vi.fn(),
  fetchCcHeadcount: vi.fn(),
}))
vi.mock('../../api/command-center', () => api)

/** The table row of an element in its first cell (the DS table gives rows no test id). */
const trOf = <T extends { element: Element }>(w: T | undefined) =>
  new DOMWrapper(w!.element.closest('tr'))
const trEl = (e: Element | null | undefined) => e!.closest('tr')!
const bodyTitle = () =>
  [...document.body.querySelectorAll('[data-slot="title"]')].at(-1)?.textContent.trim()

const SCHOOL = { id: 8080, name: 'SMK Contoh' }
const TEACHER = { id: 1919, name: 'Cikgu Contoh' }

const school: CcSchool = {
  school: SCHOOL,
  cards: { students: 1234, active: 56, answers: 130077, accuracy: 82.3 },
  teachers: [
    {
      userId: 1919,
      name: 'Cikgu Contoh',
      subjectText: 'KIMIA',
      classes: 2,
      students: 44,
      active30d: 5,
      ownerOnly: false,
    },
    {
      userId: 1920,
      name: 'Cikgu Lain',
      subjectText: null,
      classes: 0,
      students: 0,
      active30d: 0,
      ownerOnly: true,
    },
  ],
}
const teacher: CcTeacher = {
  school: SCHOOL,
  teacher: TEACHER,
  classes: [
    {
      id: 370,
      name: '5 PERNIAGAAN',
      level: 'T5',
      students: 30,
      active30d: 3,
      answers: 1234,
      accuracy: 77.75,
    },
  ],
}
const teacherEmpty: CcTeacher = { school: SCHOOL, teacher: TEACHER, classes: [] }
const klass: CcClass = {
  school: SCHOOL,
  teacher: TEACHER,
  class: { id: 370, name: '5 PERNIAGAAN', level: 'T5' },
  students: [
    {
      userId: 2022,
      name: 'Murid Satu',
      answers: 2378,
      accuracy: 93.5,
      lastActiveAt: '2026-09-25T01:22:00+08:00',
      status: 'aktif',
      mood: 'happy',
    },
    {
      userId: 2023,
      name: 'Murid Dua',
      answers: 12,
      accuracy: 40,
      lastActiveAt: null,
      status: 'tidak_aktif',
      mood: null,
    },
  ],
}
const student: CcStudent = {
  school: SCHOOL,
  teacher: TEACHER,
  class: { id: 370, name: '5 PERNIAGAAN', level: 'T5' },
  student: { id: 2022, name: 'Murid Satu' },
  cards: { answers: 2378, accuracy: 93.5, activeDays: 15, streak: 1, consistency: 27 },
  subjects: [{ code: 'UMUM', label: 'Latihan Bebas', correct: 2223, total: 2378, pct: 93.5 }],
  weeks: [
    { start: '2026-08-03', end: '2026-08-09', label: '03/08', count: 0 },
    { start: '2026-08-10', end: '2026-08-16', label: '10/08', count: 0 },
    { start: '2026-08-17', end: '2026-08-23', label: '17/08', count: 0 },
    { start: '2026-08-24', end: '2026-08-30', label: '24/08', count: 0 },
    { start: '2026-08-31', end: '2026-09-06', label: '31/08', count: 0 },
    { start: '2026-09-07', end: '2026-09-13', label: '07/09', count: 0 },
    { start: '2026-09-14', end: '2026-09-20', label: '14/09', count: 1166 },
    { start: '2026-09-21', end: '2026-09-27', label: '21/09', count: 452 },
  ],
  moodTrend: [],
  headcount: [
    {
      configId: 617,
      subject: 'Perniagaan',
      tov: 40,
      etr: null,
      rs: null,
      grade: null,
      date: '2026-06-16',
    },
  ],
  insight: {
    texts: ['Ketepatan cemerlang (93.5%).', 'Konsistensi rendah (27%) - perlu usaha lebih.'],
    source: 'Rule-based Analysis',
  },
}
const sessions: CcSessionList = {
  totalAnswers: 452,
  totalSessions: 23,
  accuracy: 99.6,
  timeSpentMinutes: 14,
  sessions: [
    {
      id: 's1',
      completedAt: '2026-09-21T00:36:00+08:00',
      subjectLabel: 'Umum',
      topic: 'Latihan Bebas',
      total: 20,
      correct: 19,
      accuracy: 95,
      minutes: 0,
    },
  ],
}
const detail: CcSessionDetail = {
  subjectLabel: 'Latihan Bebas',
  topic: null,
  completedAt: '2026-05-04T03:13:00+08:00',
  total: 2,
  correctCount: 1,
  wrongCount: 1,
  accuracy: 50,
  timeSpent: { m: 0, s: 23 },
  difficulty: null,
  answers: [
    {
      no: 1,
      correct: false,
      questionText: 'Soalan satu',
      selectedAnswer: 'B) objek',
      correctAnswer: 'D) subjek',
      answeredAt: '2026-05-04T03:13:56+08:00',
    },
    {
      no: 2,
      correct: true,
      questionText: 'Soalan dua',
      selectedAnswer: 'A) x',
      correctAnswer: 'A) x',
      answeredAt: '2026-05-04T03:14:01+08:00',
    },
  ],
}
const headcount: CcHeadcountDetail = {
  subject: 'Perniagaan',
  totalStudents: 2,
  avgTov: 29.7,
  avgEtr: 0,
  passRate: 0,
  students: [
    { userId: 1, name: 'Murid A', tov: 25, etr: null, rs: null, grade: null },
    { userId: 2, name: 'Murid B', tov: 90, etr: 80, rs: 85, grade: 'A+' },
  ],
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(
  component: object,
  props: Record<string, unknown>,
  prefix = '/admin/command-center',
): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...commandCenterDrillRoutes({ prefix, namePrefix: 'test', roles: ['admin'] }),
      { path: '/:pathMatch(.*)*', component: { template: '<i/>' } },
    ],
  })
  await router.push(`${prefix}/x`)
  wrapper = mount(component, {
    props: { basePath: prefix, ...props },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

const body = (id: string) => document.body.querySelector(`[data-testid=${id}]`)
const bodyAll = (id: string) => [...document.body.querySelectorAll(`[data-testid=${id}]`)]
const texts = (els: Element[]) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())

/** Big number and label of a `DsStatTile` (the number first, the label right after it). */
const tileOf = (el: Element) => {
  const value = el.querySelector('.tabular')
  return {
    value: value?.textContent.trim() ?? '',
    label: value?.nextElementSibling?.textContent.trim() ?? '',
  }
}
/** The cards of a page as "{label}{value}" (the live card order). */
const cards = (w: VueWrapper) =>
  w.findAll('[data-ds="stat-tile"]').map((c) => {
    const t = tileOf(c.element)
    return `${t.label}${t.value}`
  })
const firstCard = (w: VueWrapper) => w.get('[data-ds="stat-tile"]')
/** The summary tiles of the open dialog as "{value}{label}". */
const modalStats = () =>
  [...document.body.querySelectorAll('[data-testid=cc-modal-stats] [data-ds="stat-tile"]')].map(
    (el) => {
      const t = tileOf(el)
      return `${t.value}${t.label}`
    },
  )
const panelTitles = (w: VueWrapper) => w.findAll('[data-ds="panel-header"] h2')
const crumbItems = (w: VueWrapper) => w.findAll('[data-ds="breadcrumb-item"]')
/** The linked crumbs (all but the current page). */
const crumbLinks = (w: VueWrapper) =>
  crumbItems(w)
    .filter((c) => c.find('a').exists())
    .map((c) => c.text())
const crumbCurrent = (w: VueWrapper) => crumbItems(w).at(-1)?.text()

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchCcSchool.mockResolvedValue(school)
  api.fetchCcTeacher.mockResolvedValue(teacher)
  api.fetchCcClass.mockResolvedValue(klass)
  api.fetchCcStudent.mockResolvedValue(student)
  api.fetchCcStudentWeek.mockResolvedValue(sessions)
  api.fetchCcStudentAllSessions.mockResolvedValue(sessions)
  api.fetchCcStudentSubject.mockResolvedValue(sessions)
  api.fetchCcSession.mockResolvedValue(detail)
  api.fetchCcHeadcount.mockResolvedValue(headcount)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  setRouteOutcome(null)
})

// ALESA AI surfaces are hidden unless VITE_ALESA_AI=on (D73): this file covers the "on" state;
// the "off" state is in src/app/__tests__/features.test.ts and the OFF cases below.
vi.hoisted(() => {
  vi.stubEnv('VITE_ALESA_AI', 'on')
})
// Re-applied per test: files that call `vi.unstubAllEnvs()` in their own afterEach drop it.
beforeEach(() => {
  vi.stubEnv('VITE_ALESA_AI', 'on')
})

describe('S4 school', () => {
  it('renders the header, breadcrumb, cards, teacher list and sets the tab title', async () => {
    const w = await render(CommandCenterSchoolPage, { schoolId: 8080 })
    expect(w.get('[data-testid=cc-title]').text()).toBe('PrestasiPlus Command Center')
    expect(w.get('[data-testid=cc-back]').text()).toBe('Kembali ke Overview')
    expect(w.get('[data-testid=cc-back]').attributes('href')).toBe('/admin/command-center')
    expect(crumbLinks(w)[0]).toBe('Command Center')
    expect(crumbCurrent(w)).toBe('SMK Contoh')
    expect(cards(w)).toEqual([
      'Jumlah Pelajar1,234',
      'Pelajar Aktif56',
      'Jumlah Jawapan130,077',
      'Ketepatan82.3%',
    ])
    expect(panelTitles(w)[0]?.text()).toBe('Senarai Guru (2)')
    const rows = w.findAll('[data-testid=cc-teacher-row]')
    expect(rows).toHaveLength(2)
    expect(
      trOf(rows[0])
        .findAll('td')
        .map((c) => c.text())
        .slice(0, 6),
    ).toEqual(['1', 'Cikgu Contoh', 'KIMIA', '2', '44', '5'])
    expect(trOf(rows[1]).findAll('td')[2]?.text()).toBe('-')
    expect(document.title).toBe('SMK Contoh - Command Center | PRESTASIPLUS')
  })

  it('opens S5 on a row click under the given prefix (M10 / school-admin mounts)', async () => {
    for (const prefix of [
      '/admin/command-center',
      '/guru/command-center',
      '/admin-sekolah/command-center',
    ]) {
      const w = await render(CommandCenterSchoolPage, { schoolId: 8080 }, prefix)
      expect(w.get('[data-testid=cc-back]').attributes('href')).toBe(prefix)
      await w.get('[data-testid=cc-teacher-row]').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe(`${prefix}/school/8080/teacher/1919`)
      w.unmount()
    }
  })

  it('keeps the table inside its scroller', async () => {
    const w = await render(CommandCenterSchoolPage, { schoolId: 8080 })
    const scroller = w.get('[data-testid=cc-table-scroller]')
    expect(scroller.find('[data-ds="drill-table"]').classes()).toContain('overflow-x-auto')
    expect(scroller.find('table').exists()).toBe(true)
  })

  it('answers 404 in place for an unknown or out-of-scope id', async () => {
    api.fetchCcSchool.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' }),
    )
    const w = await render(CommandCenterSchoolPage, { schoolId: 1 })
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-testid=cc-page]').exists()).toBe(false)
  })

  it('shows the load error (design-system copy) for another failure and "Memuatkan..." while loading', async () => {
    let reject: (e: unknown) => void = () => undefined
    api.fetchCcSchool.mockReturnValue(new Promise((_, r) => (reject = r)))
    const w = await render(CommandCenterSchoolPage, { schoolId: 8080 })
    expect(w.get('[data-testid=cc-loading]').text()).toBe('Memuatkan...')
    reject(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))
    await flushPromises()
    expect(w.get('[data-testid=cc-error]').text()).toContain(
      'Tidak dapat memuatkan data. Sila cuba semula.',
    )
    expect(useRouteOutcome().value).toBeNull()
  })
})

describe('S5 teacher', () => {
  it('renders the info bar, class rows and opens S6', async () => {
    const w = await render(CommandCenterTeacherPage, { schoolId: 8080, userId: 1919 })
    expect(w.get('[data-testid=cc-back]').text()).toBe('Kembali ke Sekolah')
    expect(w.get('[data-testid=cc-back]').attributes('href')).toBe(
      '/admin/command-center/school/8080',
    )
    expect(crumbLinks(w)).toEqual([
      'Command Center',
      'SMK Contoh',
    ])
    expect(crumbCurrent(w)).toBe('Cikgu Contoh')
    expect(w.get('[data-testid=cc-info]').text()).toBe('Sekolah: SMK Contoh')
    expect(panelTitles(w)[0]?.text()).toBe('Senarai Kelas (1)')
    const cells = trOf(w.get('[data-testid=cc-class-row]'))
      .findAll('td')
      .map((c) => c.text())
    expect(cells).toEqual(['1', '5 PERNIAGAAN', 'T5', '30', '3', '1,234', '77.8%'])
    expect(document.title).toBe('Cikgu Contoh - Command Center | PRESTASIPLUS')
    await w.get('[data-testid=cc-class-row]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/admin/command-center/classroom/370')
  })

  it('shows "Senarai Kelas (0)" and the row "Tiada kelas aktif" without classes', async () => {
    api.fetchCcTeacher.mockResolvedValue(teacherEmpty)
    const w = await render(CommandCenterTeacherPage, { schoolId: 8080, userId: 1919 })
    expect(panelTitles(w)[0]?.text()).toBe('Senarai Kelas (0)')
    expect(w.get('[data-testid=cc-empty-row]').text()).toBe('Tiada kelas aktif')
    expect(w.findAll('[data-testid=cc-class-row]')).toHaveLength(0)
  })
})

describe('S6 class', () => {
  it('renders the info bar, student rows, status badges and mood', async () => {
    const w = await render(CommandCenterClassPage, { classroomId: 370 })
    expect(w.get('[data-testid=cc-back]').text()).toBe('Kembali ke Guru')
    expect(w.get('[data-testid=cc-back]').attributes('href')).toBe(
      '/admin/command-center/school/8080/teacher/1919',
    )
    expect(w.get('[data-testid=cc-info]').text()).toBe(
      'Sekolah: SMK ContohGuru: Cikgu ContohTahap: T5',
    )
    expect(panelTitles(w)[0]?.text()).toBe('Senarai Pelajar (2)')
    const rows = w.findAll('[data-testid=cc-student-row]')
    expect(
      trOf(rows[0])
        .findAll('td')
        .map((c) => c.text())
        .slice(0, 6),
    ).toEqual(['1', 'Murid Satu', '2,378', '93.5%', '25/09 01:22', 'Aktif'])
    expect(
      trOf(rows[1])
        .findAll('td')
        .map((c) => c.text()),
    ).toEqual(['2', 'Murid Dua', '12', '40.0%', '-', 'Tidak Aktif', '-'])
    expect(trOf(rows[0]).findAll('[data-testid=cc-status]')[0]?.text()).toBe('Aktif')
    expect(trOf(rows[1]).findAll('[data-testid=cc-status]')[0]?.text()).toBe('Tidak Aktif')
    await rows[0]?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/admin/command-center/student/2022')
  })

  it('keeps the pupil table inside its card: scroll container, 560 px floor, columns intact (DV-M17-39)', async () => {
    const w = await render(CommandCenterClassPage, { classroomId: 370 })
    const scroller = w.get('[data-testid=cc-table-scroller]')
    // The scroll container sits inside the card, so a table wider than the card scrolls there.
    expect(scroller.classes()).toEqual(expect.arrayContaining(['max-w-full', 'overflow-x-auto']))
    const table = scroller.get('[data-testid=cc-students-table]')
    expect(table.classes()).toContain('min-w-140')
    // Below md the table is as wide as its columns (never squeezed below its floor), so only the scroll container scrolls; from md it fills the card.
    expect(table.classes()).toEqual(expect.arrayContaining(['max-md:w-fit', 'max-md:max-w-none']))
    expect(scroller.findAll('th').map((h) => h.text())).toEqual([
      '#',
      'Nama Pelajar',
      'Jumlah Jawapan',
      'Ketepatan',
      'Terakhir Aktif',
      'Status',
      'Mood',
    ])
    expect(scroller.findAll('td')).toHaveLength(14)
  })

  it('degrades the breadcrumb when the scope has no school', async () => {
    api.fetchCcClass.mockResolvedValue({ ...klass, school: null })
    const w = await render(CommandCenterClassPage, { classroomId: 370 })
    expect(crumbLinks(w)).toEqual(['Command Center'])
    expect(w.get('[data-testid=cc-back]').attributes('href')).toBe('/admin/command-center')
  })
})

describe('S7 student', () => {
  it('hides "ALESA AI Insight" while the ALESA flag is off (D73)', async () => {
    vi.stubEnv('VITE_ALESA_AI', '')
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    expect(w.find('[data-testid=cc-insight]').exists()).toBe(false)
    expect(w.text()).not.toContain('ALESA AI Insight')
  })

  it('renders the five cards, subject, weeks, empty mood, headcount and the insight', async () => {
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    expect(w.get('[data-testid=cc-back]').text()).toBe('Kembali ke Kelas')
    expect(w.get('[data-testid=cc-back]').attributes('href')).toBe(
      '/admin/command-center/classroom/370',
    )
    expect(crumbLinks(w)).toEqual([
      'Command Center',
      'SMK Contoh',
      'Cikgu Contoh',
      '5 PERNIAGAAN',
    ])
    expect(crumbCurrent(w)).toBe('Murid Satu')
    expect(cards(w)).toEqual([
      'Jumlah Jawapan2,378',
      'Ketepatan93.5%',
      'Hari Aktif15',
      'Streak1',
      'Konsistensi27%',
    ])
    expect(panelTitles(w).map((p) => p.text())).toEqual([
      'Pecahan Subjek',
      'Aktiviti Mingguan (8 Minggu)',
      'Trend Mood (30 Hari)',
      'HeadCount',
      'ALESA AI Insight',
    ])
    expect(w.get('[data-testid=cc-subject-row]').text()).toContain('Latihan Bebas')
    expect(w.get('[data-testid=cc-subject-ratio]').text()).toBe('2223/2378')
    expect(w.findAll('[data-testid=cc-week]')).toHaveLength(8)
    expect(w.findAll('[data-testid=cc-week]').map((x) => x.attributes('data-count'))).toEqual([
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '1166',
      '452',
    ])
    expect(w.get('[data-testid=cc-mood-empty]').text()).toBe('Tiada data mood')
    const hc = trOf(w.get('[data-testid=cc-headcount-row]'))
      .findAll('td')
      .map((c) => c.text().replace(/\s+/g, ' '))
    expect(hc).toEqual(['Perniagaan', '40.00', '-', '-', '-', '16/06/2026'])
    expect(w.get('[data-testid=cc-insight-text]').text()).toBe(
      'Ketepatan cemerlang (93.5%). Konsistensi rendah (27%) - perlu usaha lebih.',
    )
    expect(w.get('[data-testid=cc-insight]').text()).toContain('Analisis ALESA')
    expect(w.get('[data-testid=cc-insight]').text()).toContain('Sumber: Rule-based Analysis')
    expect(document.title).toBe('Murid Satu - Command Center | PRESTASIPLUS')
  })

  it('opens the all-sessions modal from the first card and closes by x and by backdrop', async () => {
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    await firstCard(w).trigger('click')
    await flushPromises()
    expect(api.fetchCcStudentAllSessions).toHaveBeenCalledWith(2022, expect.anything())
    expect(bodyTitle()).toBe('Semua Sesi Latihan')
    expect(modalStats()).toEqual([
      '452Jawapan',
      '23Sesi',
      '99.6%Ketepatan',
      '14mJumlah Masa',
    ])
    const row = body('cc-session-row')
    expect(row?.getAttribute('title')).toBeNull() // live: no title on the all-sessions rows
    expect(texts([...trEl(row).querySelectorAll('td')])).toEqual([
      '21/09 00:36',
      'Umum',
      '20',
      '19',
      '95.00%',
      '0m',
    ])
    ;(body('cc-modal-close') as HTMLElement).click()
    await flushPromises()
    expect(body('cc-sessions-modal')).toBeNull()
  })

  it('opens a week modal for a non-zero bar only', async () => {
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    const bars = w.findAll('[data-testid=cc-week]')
    await bars[0]?.trigger('click')
    await flushPromises()
    expect(api.fetchCcStudentWeek).not.toHaveBeenCalled()
    expect(body('cc-sessions-modal')).toBeNull()
    await bars[7]?.trigger('click')
    await flushPromises()
    expect(api.fetchCcStudentWeek).toHaveBeenCalledWith(
      2022,
      '2026-09-21',
      '2026-09-27',
      expect.anything(),
    )
    expect(bodyTitle()).toBe('Minggu 21/09 (2026-09-21 ~ 2026-09-27)')
    expect(modalStats()[3]).toBe('14mMasa')
    expect(body('cc-session-row')?.getAttribute('title')).toBe('Klik untuk lihat soalan')
  })

  it('opens the subject modal with the "Topik" column', async () => {
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    await w.get('[data-testid=cc-subject-row]').trigger('click')
    await flushPromises()
    expect(api.fetchCcStudentSubject).toHaveBeenCalledWith(2022, 'UMUM', expect.anything())
    expect(bodyTitle()).toBe('Latihan Bebas — Semua Sesi')
    const heads = texts([...(body('cc-sessions-table')?.querySelectorAll('th') ?? [])])
    expect(heads).toEqual(['Tarikh', 'Topik', 'Soalan', 'Betul', 'Ketepatan', 'Masa'])
    // live: the subject modal labels the time tile "Masa" (only all sessions says "Jumlah Masa")
    expect(modalStats()[3]).toBe('14mMasa')
    expect(body('cc-session-row')?.getAttribute('title')).toBe('Klik soalan')
    expect(texts([...trEl(body('cc-session-row')).querySelectorAll('td')])[1]).toBe('Latihan Bebas')
  })

  it('shows the empty copy of a week and of all sessions, and the error copy', async () => {
    const empty: CcSessionList = { ...sessions, totalAnswers: 0, totalSessions: 0, sessions: [] }
    api.fetchCcStudentWeek.mockResolvedValue(empty)
    api.fetchCcStudentAllSessions.mockResolvedValue(empty)
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    await w.findAll('[data-testid=cc-week]')[7]?.trigger('click')
    await flushPromises()
    expect(body('cc-modal-empty')?.textContent.trim()).toBe('Tiada sesi minggu ini')
    ;(body('cc-modal-close') as HTMLElement).click()
    await flushPromises()
    await firstCard(w).trigger('click')
    await flushPromises()
    expect(body('cc-modal-empty')?.textContent.trim()).toBe('Tiada sesi')
    ;(body('cc-modal-close') as HTMLElement).click()
    await flushPromises()
    api.fetchCcStudentAllSessions.mockRejectedValue(new Error('x'))
    await firstCard(w).trigger('click')
    await flushPromises()
    expect(body('cc-modal-error')?.textContent).toContain('Ralat memuatkan data')
  })

  it('opens the session modal from a row, above the sessions modal', async () => {
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    await firstCard(w).trigger('click')
    await flushPromises()
    ;(body('cc-session-row') as HTMLElement).click()
    await flushPromises()
    expect(api.fetchCcSession).toHaveBeenCalledWith('s1', expect.anything())
    const modal = body('cc-session-modal')
    expect(modal).not.toBeNull()
    expect(body('cc-sessions-modal')).not.toBeNull()
    const text = modal?.textContent.replace(/\s+/g, ' ') ?? ''
    expect(bodyTitle()).toBe('Latihan Bebas — -')
    expect(text).toContain('04/05/2026 03:13 | Kesukaran: - | Masa: 0m 23s')
    expect(text).toContain('Jawapan anda: B) objek')
    expect(text).toContain('Jawapan betul: D) subjek')
    expect(text).toContain('03:13:56')
    expect(text).toContain('50.00%')
    const rows = bodyAll('cc-answer-row')
    expect(rows.map((r) => r.getAttribute('data-correct'))).toEqual(['false', 'true'])
  })

  it('shows "Tiada data soalan" for a session without answers', async () => {
    api.fetchCcSession.mockResolvedValue({ ...detail, total: 0, answers: [] })
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    await firstCard(w).trigger('click')
    await flushPromises()
    ;(body('cc-session-row') as HTMLElement).click()
    await flushPromises()
    expect(body('cc-session-modal')?.textContent).toContain('Tiada data soalan')
  })

  it('opens the headcount modal with the summary and grade colours', async () => {
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    await w.get('[data-testid=cc-headcount-row]').trigger('click')
    await flushPromises()
    expect(api.fetchCcHeadcount).toHaveBeenCalledWith(617, expect.anything())
    expect(bodyTitle()).toBe('HeadCount: Perniagaan')
    expect(modalStats()).toEqual([
      '2Pelajar',
      '29.7Purata TOV',
      '0Purata ETR',
      '0%Kadar Lulus',
    ])
    const rows = bodyAll('cc-headcount-student')
    expect(texts([...trEl(rows[0]).querySelectorAll('td')])).toEqual([
      '1',
      'Murid A',
      '25.00',
      '-',
      '-',
      '-',
    ])
    expect(trEl(rows[0]).querySelectorAll('td')[5]?.querySelector('span')?.className).toContain(
      'text-warning',
    )
    expect(trEl(rows[1]).querySelectorAll('td')[5]?.querySelector('span')?.className).toContain(
      'text-success',
    )
  })

  it('shows "Ralat" when the headcount modal fails', async () => {
    api.fetchCcHeadcount.mockRejectedValue(new Error('x'))
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    await w.get('[data-testid=cc-headcount-row]').trigger('click')
    await flushPromises()
    expect(body('cc-modal-error')?.textContent).toContain('Ralat')
  })

  it('renders mood dots and opens the mood-day modal without a request (FR-M17-59)', async () => {
    api.fetchCcStudent.mockResolvedValue({
      ...student,
      moodTrend: [
        { date: '2026-09-08', mood: 'stressed', reason: 'Peperiksaan' },
        { date: '2026-09-22', mood: 'happy', reason: null },
      ],
    })
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    const dots = w.findAll('[data-testid=cc-mood-dot]')
    expect(dots.map((d) => d.attributes('title'))).toEqual([
      '2026-09-08 — Tekanan',
      '2026-09-22 — Gembira',
    ])
    expect(w.find('[data-testid=cc-mood-empty]').exists()).toBe(false)

    await dots[0]?.trigger('click')
    expect(bodyTitle()).toBe('2026-09-08 — Mood: Tekanan')
    expect(modalStats()).toEqual(['TekananMood', 'PeperiksaanSebab'])
    // the week of 07/09 has no sessions: the page data proves it
    expect(body('cc-modal-empty')?.textContent.trim()).toBe(
      'Tiada sesi latihan pada hari ini. Pelajar hanya checkin mood.',
    )
    ;(body('cc-modal-close') as HTMLElement).click()
    await flushPromises()

    await dots[1]?.trigger('click')
    expect(bodyTitle()).toBe('2026-09-22 — Mood: Gembira')
    expect(modalStats()[1]).toBe('-Sebab')
    expect(body('cc-modal-empty')).toBeNull()
    expect(api.fetchCcStudentWeek).not.toHaveBeenCalled()
  })

  it('answers 404 in place', async () => {
    api.fetchCcStudent.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(CommandCenterStudentPage, { userId: 9 })
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('D10: live interaction elements, no accessibility additions', () => {
  it('renders clickable cards, rows, weeks and dots as buttons', async () => {
    api.fetchCcStudent.mockResolvedValue({
      ...student,
      moodTrend: [{ date: '2026-09-22', mood: 'happy', reason: null }],
    })
    const school = await render(CommandCenterSchoolPage, { schoolId: 8080 })
    expect(school.find('tbody tr').exists()).toBe(true)
    school.unmount()
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    expect(firstCard(w).element.tagName, 'cc-stat').toBe('BUTTON')
    for (const id of ['cc-subject-row', 'cc-week', 'cc-mood-dot']) {
      expect(w.get(`[data-testid=${id}]`).element.tagName, id).toBe('BUTTON')
    }
    expect(w.get('[data-testid=cc-mood-dot]').attributes('title')).toBe('2026-09-22 — Gembira')
  })

  it('the dialog has a labelled close button', async () => {
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    await firstCard(w).trigger('click')
    await flushPromises()
    expect(body('cc-sessions-modal')).not.toBeNull()
    expect(body('cc-modal-close')?.textContent.trim()).toBe('Tutup')
  })

  it('splits a week label below sm into two lines without changing its text', async () => {
    const w = await render(CommandCenterStudentPage, { userId: 2022 })
    expect(w.get('[data-testid=cc-week-label]').text()).toBe('03/08')
  })
})

describe('commandCenterDrillRoutes', () => {
  const routes = commandCenterDrillRoutes({
    prefix: '/guru/command-center/',
    namePrefix: 'm10.cc',
    roles: ['teacher'],
  })

  it('builds the four bare routes under the prefix with digit-only ids', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '/guru/command-center/school/:schoolId(\\d+)',
      '/guru/command-center/school/:schoolId(\\d+)/teacher/:userId(\\d+)',
      '/guru/command-center/classroom/:classroomId(\\d+)',
      '/guru/command-center/student/:userId(\\d+)',
    ])
    expect(routes.map((r) => r.name)).toEqual([
      'm10.cc.school',
      'm10.cc.teacher',
      'm10.cc.classroom',
      'm10.cc.student',
    ])
    for (const r of routes) {
      expect(r.meta).toMatchObject({ layout: 'bare', access: 'auth', roles: ['teacher'] })
    }
  })

  it('passes numeric ids and the normalised prefix as props', () => {
    const props = routes[1]?.props as (r: unknown) => unknown
    expect(props({ params: { schoolId: '8080', userId: '1919' } })).toEqual({
      schoolId: 8080,
      userId: 1919,
      basePath: '/guru/command-center',
    })
  })
})
