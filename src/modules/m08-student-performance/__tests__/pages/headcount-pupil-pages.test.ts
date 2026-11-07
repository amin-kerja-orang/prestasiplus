// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router'
import { setRouteOutcome } from '@/app/router/outcome'

import type {
  HeadcountDetail,
  HeadcountListItem,
  HeadcountSection,
} from '../../api/headcount-types'
import HeadcountDashboardPage from '../../pages/HeadcountDashboardPage.vue'
import HeadcountIndexPage from '../../pages/HeadcountIndexPage.vue'
import HeadcountStudentPage from '../../pages/HeadcountStudentPage.vue'
import HeadcountTablePage from '../../pages/HeadcountTablePage.vue'

/**
 * S10-T09: the pupil read screens (R1-MUR-3) and the school-admin read-only mode (R1-AS-3) on the shared
 * pages. The API client is mocked; the session store is a plain object set per test.
 */
const api = vi.hoisted(() => ({
  fetchHeadcounts: vi.fn(),
  fetchHeadcountMe: vi.fn(),
  fetchHeadcountMeDetail: vi.fn(),
  fetchHeadcountDashboard: vi.fn(),
  fetchHeadcountStudent: vi.fn(),
  fetchHeadcountDetail: vi.fn(),
  autoSetupHeadcounts: vi.fn(),
  resetHeadcount: vi.fn(),
  deleteHeadcount: vi.fn(),
  dropHeadcountStudents: vi.fn(),
  downloadHeadcountCsv: vi.fn(),
}))
vi.mock('../../api/headcount', () => api)

const session = vi.hoisted(() => ({
  role: null as string | null,
  user: null as { id: number } | null,
}))
vi.mock('@/stores/session', () => ({ useSessionStore: () => session }))

let wrapper: VueWrapper | null = null

async function render(component: object, path: string, route = path.replace(/\?.*/, '')) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component })
  await router.push(path)
  wrapper = mount(component, {
    global: { plugins: [router], stubs: { ChartCanvas: { template: '<div data-testid="chart" />' } } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid=${id}]`).exists()
const apiError = (status: number) => new ApiError({ status, code: 'X', message: 'x' })

beforeEach(() => {
  setRouteOutcome(null)
  for (const fn of Object.values(api)) fn.mockReset()
  session.role = 'student'
  session.user = { id: 47 }
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const ITEM: HeadcountListItem = {
  id: 501,
  className: '5 A',
  subjectName: 'Kimia',
  levelName: 'Tingkatan 5',
  year: 2026,
  mode: 'auto',
  activeOtrs: 3,
  students: 8,
  teacherName: 'Guru Demo',
  entryStatus: 'active',
  statusReason: null,
}

describe('pupil /headcount (HeadcountMuridPage)', () => {
  it('shows the hero and one card per config with chip, pill and "Lihat Data Saya"', async () => {
    api.fetchHeadcountMe.mockResolvedValue([
      ITEM,
      { ...ITEM, id: 502, subjectName: 'Fizik', mode: 'manual', entryStatus: 'draft', statusReason: 'belum_ada_data' },
    ])
    const w = await render(HeadcountIndexPage, '/headcount')
    expect(api.fetchHeadcounts).not.toHaveBeenCalled()
    expect(t(w, 'headcount-hero').text()).toContain('Tracking prestasi murid — TOV, OTR, AR & RS')
    expect(t(w, 'headcount-card-501').text()).toContain('Kimia')
    expect(t(w, 'headcount-card-501').text()).toContain('5 A · Tingkatan 5')
    expect(t(w, 'headcount-mode-501').text()).toBe('Auto')
    expect(t(w, 'headcount-pill-501').text()).toBe('Active')
    expect(has(w, 'headcount-draft-501')).toBe(false)
    expect(t(w, 'headcount-mode-502').text()).toBe('Manual')
    expect(t(w, 'headcount-pill-502').text()).toBe('Draft')
    expect(t(w, 'headcount-draft-502').text()).toBe('Belum Ada Data')
    expect(t(w, 'headcount-open-501').text()).toContain('Lihat Data Saya')
    expect(t(w, 'headcount-open-501').attributes('href')).toBe('/headcount/student/47?configId=501')
    expect(t(w, 'headcount-open-502').attributes('href')).toBe('/headcount/student/47?configId=502')
  })

  it('the empty state has the exact copy and no button', async () => {
    api.fetchHeadcountMe.mockResolvedValue([])
    const w = await render(HeadcountIndexPage, '/headcount')
    const empty = t(w, 'headcount-empty')
    expect(empty.text()).toContain('Belum ada Headcount')
    expect(empty.text()).toContain('Guru anda belum menyediakan headcount bagi kelas anda tahun ini.')
    expect(empty.find('a, button').exists()).toBe(false)
  })

  it('renders no write control (create, Auto-Setup, delete) in the DOM', async () => {
    api.fetchHeadcountMe.mockResolvedValue([ITEM])
    const w = await render(HeadcountIndexPage, '/headcount')
    for (const id of ['hero-create', 'hero-auto-setup', 'hero-dashboard', 'headcount-create-now', 'auto-setup-modal']) {
      expect(has(w, id)).toBe(false)
    }
    expect(w.text()).not.toMatch(/Buat Baru|Auto-Setup|Padam|Buat Sekarang/)
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('a failure is the load-error box; a 403 the 403 page', async () => {
    api.fetchHeadcountMe.mockRejectedValue(new Error('boom'))
    const w = await render(HeadcountIndexPage, '/headcount')
    expect(has(w, 'page-error')).toBe(true)
    wrapper?.unmount()
    api.fetchHeadcountMe.mockRejectedValue(apiError(403))
    await render(HeadcountIndexPage, '/headcount')
    expect(useRouteOutcome().value).toBe(403)
  })
})

const SECTION: HeadcountSection = {
  configId: 501,
  subject: 'Kimia',
  school: 'SMK DEMO',
  levelName: 'Tingkatan 5',
  className: '5 A',
  year: 2026,
  mode: 'manual',
  status: 'on',
  statusReason: null,
  entryStatus: 'active',
  jurang: 40,
  unjuran: null,
  keyakinan: null,
  tov: 40,
  etr: 80,
  rs: null,
  projection: null,
  rows: [
    { checkpoint: 1, target: 53, targetGrade: 'C+', ar: 70, arGrade: 'A-', tone: 'on' },
    { checkpoint: 2, target: 66, targetGrade: 'B+', ar: null, arGrade: null, tone: 'noAr' },
  ],
  prediction: null,
  chart: {
    labels: ['TOV', 'OTR1', 'OTR2', 'ETR'],
    target: [40, 53, 66, 80],
    actual: [40, 70, null, null],
    projection: [null, null, null, null],
    rs: null,
  },
}

describe('pupil /headcount/student/:ownId (HeadcountStudentPage)', () => {
  const open = (q = '?configId=501', id = 47) =>
    render(HeadcountStudentPage, `/headcount/student/${String(id)}${q}`, '/headcount/student/:id')

  it('own id: reads me/detail with the configId, title "Headcount", Active pill, Jurang, Manual AR "—"', async () => {
    api.fetchHeadcountMeDetail.mockResolvedValue({
      student: { id: 47, name: 'Murid Demo', school: 'SMK DEMO' },
      sections: [SECTION],
    })
    const w = await open()
    expect(api.fetchHeadcountMeDetail).toHaveBeenCalledWith('501', expect.anything())
    expect(api.fetchHeadcountStudent).not.toHaveBeenCalled()
    expect(t(w, 'student-name').text()).toBe('Headcount')
    expect(w.text()).not.toContain('Murid Demo')
    expect(t(w, 'entry-pill').text()).toBe('Active')
    expect(t(w, 'status-pill').text()).toBe('On Track')
    expect(t(w, 'chip-jurang').text()).toBe('Jurang: +40')
    expect(t(w, 'row-otr-1').element.closest('tr')?.textContent).toContain('70.0')
    expect(t(w, 'row-otr-2').element.closest('tr')?.textContent).toContain('—')
  })

  describe('goal text (AC-MUR-3-2)', () => {
    const withRows = (
      ars: (number | null)[],
      etr: number | null = 80,
      tone: 'on' | 'below' | 'noAr' = 'below',
    ): HeadcountSection => ({
      ...SECTION,
      etr,
      jurang: 40,
      rows: ars.map((ar, i) => ({
        checkpoint: i + 1,
        target: 53 + i * 13,
        targetGrade: 'C+',
        ar,
        arGrade: ar === null ? null : 'B',
        tone: ar === null ? 'noAr' : tone,
      })),
    })
    const goal = async (section: HeadcountSection) => {
      api.fetchHeadcountMeDetail.mockResolvedValue({
        student: { id: 47, name: 'Murid Demo', school: null },
        sections: [section],
      })
      return open()
    }

    it('AR 60 below RS 80: "Belum capai sasaran" beside "Jurang: +40", status text in the rows', async () => {
      const w = await goal(withRows([60, 60, 60]))
      expect(t(w, 'chip-goal').text()).toBe('Belum capai sasaran')
      expect(t(w, 'chip-jurang').text()).toBe('Jurang: +40')
      expect(w.get('[data-testid="summary-chips"]').text()).toContain('Belum capai sasaran')
      expect(w.findAll('[data-testid="row-status"]').map((r) => r.text())).toEqual([
        'Below',
        'Below',
        'Below',
      ])
    })

    it('AR 80 equal to RS 80 (and above): "Sasaran tercapai"', async () => {
      const w = await goal(withRows([80, 80, 80], 80, 'on'))
      expect(t(w, 'chip-goal').text()).toBe('Sasaran tercapai')
      expect(w.text()).not.toContain('Belum capai sasaran')
      expect(w.findAll('[data-testid="row-status"]').map((r) => r.text())).toEqual([
        'On Track',
        'On Track',
        'On Track',
      ])
      wrapper?.unmount()
      const above = await goal(withRows([95, null], 80, 'on'))
      expect(t(above, 'chip-goal').text()).toBe('Sasaran tercapai')
    })

    it('uses the latest checkpoint that has an AR', async () => {
      const w = await goal(withRows([90, 50, null]))
      expect(t(w, 'chip-goal').text()).toBe('Belum capai sasaran')
    })

    it('AR 0 is a value: "Belum capai sasaran"', async () => {
      const w = await goal(withRows([0]))
      expect(t(w, 'chip-goal').text()).toBe('Belum capai sasaran')
    })

    it('no AR yet, or no ETR: neither text is shown', async () => {
      const noAr = await goal(withRows([null, null]))
      expect(has(noAr, 'chip-goal')).toBe(false)
      wrapper?.unmount()
      const noEtr = await goal(withRows([60], null))
      expect(has(noEtr, 'chip-goal')).toBe(false)
    })

    it('a negative Jurang (RS below TOV) reads "-n"', async () => {
      const w = await goal({ ...withRows([60]), tov: 80, etr: 75, jurang: -5 })
      expect(t(w, 'chip-jurang').text()).toBe('Jurang: -5')
      expect(t(w, 'chip-goal').text()).toBe('Belum capai sasaran')
    })

    it('a zero Jurang reads "0" (no sign), as on Tetapan', async () => {
      const w = await goal({ ...withRows([60]), tov: 80, etr: 80, jurang: 0 })
      expect(t(w, 'chip-jurang').text()).toBe('Jurang: 0')
    })

    it('a teacher view has no goal chip', async () => {
      session.role = 'teacher'
      api.fetchHeadcountStudent.mockResolvedValue({
        student: { id: 47, name: 'Murid Demo', school: null },
        sections: [withRows([60])],
      })
      const w = await open('', 47)
      expect(has(w, 'chip-goal')).toBe(false)
    })
  })

  it('another pupil id is the 403 page and no request is made', async () => {
    await open('?configId=501', 99)
    expect(useRouteOutcome().value).toBe(403)
    expect(api.fetchHeadcountMeDetail).not.toHaveBeenCalled()
    expect(api.fetchHeadcountStudent).not.toHaveBeenCalled()
  })

  it('a foreign or unknown configId (404) is the 404 page', async () => {
    api.fetchHeadcountMeDetail.mockRejectedValue(apiError(404))
    await open('?configId=9')
    expect(useRouteOutcome().value).toBe(404)
  })

  it('a Draft (no ETR) shows "Belum Ada Data", no table, no chart and no error', async () => {
    api.fetchHeadcountMeDetail.mockResolvedValue({
      student: { id: 47, name: 'Murid Demo', school: null },
      sections: [
        {
          ...SECTION,
          entryStatus: 'draft',
          status: 'none',
          statusReason: 'belum_ada_data',
          tov: null,
          etr: null,
          jurang: null,
        },
      ],
    })
    const w = await open()
    expect(t(w, 'entry-pill').text()).toBe('Draft')
    expect(t(w, 'draft-note').text()).toBe('Belum Ada Data')
    expect(has(w, 'table-501')).toBe(false)
    expect(has(w, 'student-chart-501')).toBe(false)
    expect(has(w, 'page-error')).toBe(false)
    expect(useRouteOutcome().value).toBeNull()
  })

  it('an ETR without a TOV reads "Belum Ada TOV" with Jurang and the OTR targets "—"', async () => {
    api.fetchHeadcountMeDetail.mockResolvedValue({
      student: { id: 47, name: 'Murid Demo', school: null },
      sections: [
        {
          ...SECTION,
          status: 'none',
          statusReason: 'belum_ada_tov',
          tov: null,
          jurang: null,
          rows: [
            { checkpoint: 1, target: null, targetGrade: null, ar: null, arGrade: null, tone: 'noAr' },
          ],
        },
      ],
    })
    const w = await open()
    expect(t(w, 'entry-pill').text()).toBe('Active')
    expect(t(w, 'status-pill').text()).toBe('Belum Ada TOV')
    expect(t(w, 'chip-jurang').text()).toBe('Jurang: —')
    expect(t(w, 'row-otr-1').element.closest('tr')?.textContent).toContain('—')
  })

  it('no config: the empty state with the exact copy', async () => {
    api.fetchHeadcountMeDetail.mockResolvedValue({
      student: { id: 47, name: 'Murid Demo', school: null },
      sections: [],
    })
    const w = await open('')
    expect(api.fetchHeadcountMeDetail).toHaveBeenCalledWith(null, expect.anything())
    expect(t(w, 'student-empty').text()).toContain('Belum ada Headcount')
    expect(t(w, 'student-empty').text()).toContain(
      'Guru anda belum menyediakan headcount bagi kelas anda tahun ini.',
    )
  })

  it('a teacher keeps the staff view: students API, pupil name as title, no Active/Draft pill', async () => {
    session.role = 'teacher'
    api.fetchHeadcountStudent.mockResolvedValue({
      student: { id: 47, name: 'Murid Demo', school: null },
      sections: [SECTION],
    })
    const w = await open('', 47)
    expect(api.fetchHeadcountMeDetail).not.toHaveBeenCalled()
    expect(t(w, 'student-name').text()).toBe('Murid Demo')
    expect(has(w, 'entry-pill')).toBe(false)
    expect(has(w, 'chip-jurang')).toBe(false)
  })
})

const CONFIG_ROW = {
  userId: 1,
  name: 'Murid A',
  tov: 60,
  tovGrade: 'B' as const,
  cells: [
    { target: 62, targetGrade: 'B' as const, ar: 65, arGrade: 'B+' as const, tone: 'above' as const },
  ],
  etr: 75,
  etrGrade: 'A-' as const,
  dropped: false,
  rs: null,
  rsRecordedAt: null,
  status: 'on' as const,
  statusReason: null,
  entryStatus: 'active' as const,
  projection: null,
}
const DETAIL: HeadcountDetail = {
  config: {
    id: 501,
    subject: 'Kimia',
    className: '5 A',
    levelName: 'Tingkatan 5',
    year: 2026,
    teacherName: 'Guru Demo',
    status: 'active',
    activeOtrs: 1,
    mode: 'manual',
    defaultTov: null,
    defaultEtr: null,
  },
  chips: { onTrack: 1, below: 0, empty: 0, total: 1, onTrackPct: 100 },
  rows: [CONFIG_ROW],
  averages: { tov: 60, otrs: [62], ars: [65], etr: 75 },
}

describe('school admin read-only (R1-AS-3)', () => {
  beforeEach(() => {
    session.role = 'school_admin'
    session.user = { id: 8 }
  })

  it('the list hides create, Auto-Setup and "Buat Sekarang", keeps the Guru column', async () => {
    api.fetchHeadcounts.mockResolvedValue([ITEM])
    const w = await render(HeadcountIndexPage, '/headcount')
    expect(api.fetchHeadcountMe).not.toHaveBeenCalled()
    for (const id of ['hero-create', 'hero-auto-setup']) expect(has(w, id)).toBe(false)
    expect(has(w, 'hero-dashboard')).toBe(true)
    expect(document.body.querySelector('[data-testid=auto-setup-modal]')).toBeNull()
    expect(w.text()).toContain('Guru')
    expect(w.text()).toContain('Guru Demo')
    expect(t(w, 'headcount-card-501').attributes('href')).toBe('/headcount/501')
  })

  it('an empty school list has no "Buat Sekarang"', async () => {
    api.fetchHeadcounts.mockResolvedValue([])
    const w = await render(HeadcountIndexPage, '/headcount')
    expect(has(w, 'headcount-empty')).toBe(true)
    expect(has(w, 'headcount-create-now')).toBe(false)
  })

  it('a teacher sees the write controls and no Guru column', async () => {
    session.role = 'teacher'
    api.fetchHeadcounts.mockResolvedValue([ITEM])
    const w = await render(HeadcountIndexPage, '/headcount')
    expect(has(w, 'hero-create')).toBe(true)
    expect(has(w, 'hero-auto-setup')).toBe(true)
    expect(w.text()).not.toContain('Guru Demo')
  })

  it('the table page keeps Export, Ringkasan, Unjuran and the sort links but has no write control', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    for (const id of ['action-export', 'action-summary', 'action-unjuran', 'sort-ranking', 'sort-name']) {
      expect(has(w, id)).toBe(true)
    }
    for (const id of [
      'action-key-in',
      'action-edit',
      'action-settings',
      'action-reset',
      'action-delete',
      'selection-bar',
      'select-all',
      'select-1',
    ]) {
      expect(has(w, id)).toBe(false)
    }
    expect(w.findAll('[role=checkbox]')).toHaveLength(0)
    expect(document.body.querySelector('[data-testid=reset-modal]')).toBeNull()
    expect(w.text()).toContain('Guru: Guru Demo')
    // The row still opens the pupil's detail.
    expect(t(w, 'row-1').attributes('href')).toBe('/headcount/student/1')
  })

  it('the teacher still gets every write control on the table page', async () => {
    session.role = 'teacher'
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    for (const id of ['action-key-in', 'action-edit', 'action-settings', 'action-reset', 'action-delete', 'select-all']) {
      expect(has(w, id)).toBe(true)
    }
  })

  it('the dashboard config cards carry a "Guru" line for the school admin, not for the teacher', async () => {
    const dashboard = {
      configs: [
        {
          id: 501, level: 11, levelName: 'Tingkatan 5', className: '5 A', subjectName: 'Kimia', year: 2026,
          mode: 'auto', teacherName: 'Guru Demo', onTrack: 1, offTrack: 0, noData: 0, totalStudents: 1,
          chart: { labels: ['OTR1'], target: [60], actual: [65] },
        },
      ],
    }
    api.fetchHeadcountDashboard.mockResolvedValue(dashboard)
    const w = await render(HeadcountDashboardPage, '/headcount/dashboard')
    expect(t(w, 'chart-teacher-501').text()).toBe('Guru: Guru Demo')
    wrapper?.unmount()
    session.role = 'teacher'
    const w2 = await render(HeadcountDashboardPage, '/headcount/dashboard')
    expect(has(w2, 'chart-teacher-501')).toBe(false)
  })
})
