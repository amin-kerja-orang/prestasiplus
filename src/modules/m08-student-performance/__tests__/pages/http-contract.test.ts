// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import USelect from '@nuxt/ui/components/Select.vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router'
import { setRouteOutcome } from '@/app/router/outcome'

import type { HeadcountDetail } from '../../api/headcount-types'
import type { Leaderboard, PublicProfile, Ranking, TimelinePost } from '../../api/types'
import { apiQuery } from '../../lib/ranking'
import { routeId } from '../../lib/route-id'
import { sortPosts } from '../../lib/timeline/posts'
import HeadcountCreatePage from '../../pages/HeadcountCreatePage.vue'
import HeadcountExportPage from '../../pages/HeadcountExportPage.vue'
import HeadcountStudentPage from '../../pages/HeadcountStudentPage.vue'
import HeadcountSummaryPage from '../../pages/HeadcountSummaryPage.vue'
import HeadcountTablePage from '../../pages/HeadcountTablePage.vue'
import LeaderboardPage from '../../pages/LeaderboardPage.vue'
import Prestasi360Page from '../../pages/Prestasi360Page.vue'
import PublicProfilePage from '../../pages/PublicProfilePage.vue'
import RankingPage from '../../pages/RankingPage.vue'
import TimelinePage from '../../pages/TimelinePage.vue'

/**
 * BE-19 http-mode sweep: string ids, uniform 404 on headcount, masked names (`userId: null`), empty
 * public-profile posts. Mock-mode behaviour is covered by the other page tests and stays untouched.
 */

const hc = vi.hoisted(() => ({
  fetchHeadcounts: vi.fn(),
  fetchHeadcountDashboard: vi.fn(),
  fetchHeadcountFormOptions: vi.fn(),
  createHeadcount: vi.fn(),
  autoSetupHeadcounts: vi.fn(),
  fetchHeadcountStudent: vi.fn(),
  fetchHeadcountSummary: vi.fn(),
  fetchHeadcountDetail: vi.fn(),
  resetHeadcount: vi.fn(),
  deleteHeadcount: vi.fn(),
  dropHeadcountStudents: vi.fn(),
  downloadHeadcountCsv: vi.fn(),
}))
vi.mock('../../api/headcount', () => hc)

const perf = vi.hoisted(() => ({
  fetchRankings: vi.fn(),
  fetchLeaderboard: vi.fn(),
  fetchTimeline: vi.fn(),
  fetchPublicProfile: vi.fn(),
  fetchStudentPerformance: vi.fn(),
}))
vi.mock('../../api/performance', () => perf)
vi.mock('../../lib/subject-options', () => ({ fetchSubjectOptions: vi.fn().mockResolvedValue([]) }))

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: object, path: string, route = path.replace(/\?.*/, '')) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component })
  await router.push(path)
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
const body = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid=${id}]`)
const apiError = (status: number) => new ApiError({ status, code: 'X', message: 'x' })

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  vi.stubEnv('VITE_API_MODE', 'http')
  for (const fn of [...Object.values(hc), ...Object.values(perf)]) fn.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllEnvs()
})

describe('string ids (http mode only)', () => {
  it('routeId keeps the string on the real API and the number in mock mode', () => {
    expect(routeId('1042')).toBe('1042')
    vi.unstubAllEnvs()
    expect(routeId('1042')).toBe(1042)
  })

  it('the ranking subject filter is sent as the id string', () => {
    const state = { scope: '', subjectId: '77', tingkatan: '', negeri: '' }
    expect(apiQuery(state).subjectId).toBe('77')
    vi.unstubAllEnvs()
    expect(apiQuery(state).subjectId).toBe(77)
  })

  it('sortPosts breaks ties on string ids without NaN', () => {
    const base = { eventDate: null, createdAt: '2026-08-15T09:00:00+08:00' }
    const posts = [
      { ...base, id: '9' },
      { ...base, id: '10' },
      { ...base, id: '8' },
    ] as unknown as TimelinePost[]
    expect(sortPosts(posts).map((p) => String(p.id))).toEqual(['10', '9', '8'])
    const nums = [
      { ...base, id: 1 },
      { ...base, id: 3 },
    ] as unknown as TimelinePost[]
    expect(sortPosts(nums).map((p) => p.id)).toEqual([3, 1])
  })

  it('Prestasi 360 and the public profile fetch with the id string', async () => {
    perf.fetchStudentPerformance.mockRejectedValue(apiError(404))
    await render(Prestasi360Page, '/prestasi/1042', '/prestasi/:userId')
    expect(perf.fetchStudentPerformance.mock.calls[0]?.[0]).toBe('1042')
    wrapper?.unmount()
    perf.fetchPublicProfile.mockRejectedValue(apiError(404))
    await render(PublicProfilePage, '/pelajar/1042', '/pelajar/:id')
    expect(perf.fetchPublicProfile.mock.calls[0]?.[0]).toBe('1042')
  })

  it('the headcount pages fetch with the id string', async () => {
    hc.fetchHeadcountDetail.mockRejectedValue(apiError(404))
    hc.fetchHeadcountSummary.mockRejectedValue(apiError(404))
    hc.fetchHeadcountStudent.mockRejectedValue(apiError(404))
    await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    expect(hc.fetchHeadcountDetail.mock.calls[0]?.[0]).toBe('501')
    wrapper?.unmount()
    await render(HeadcountSummaryPage, '/headcount/501/summary', '/headcount/:id/summary')
    expect(hc.fetchHeadcountSummary.mock.calls[0]?.[0]).toBe('501')
    wrapper?.unmount()
    await render(HeadcountStudentPage, '/headcount/student/12', '/headcount/student/:id')
    expect(hc.fetchHeadcountStudent.mock.calls[0]?.[0]).toBe('12')
  })

  it('creating a headcount posts the id strings the contract requires', async () => {
    hc.fetchHeadcountFormOptions.mockResolvedValue({
      classes: [{ id: '9', name: '5 A' }],
      subjects: [{ id: '3', name: 'Kimia', code: 'KIM' }],
      levels: [{ id: '11', name: 'Tingkatan 5' }],
      defaultYear: 2026,
    })
    hc.createHeadcount.mockResolvedValue({ id: '700' })
    const w = await render(HeadcountCreatePage, '/headcount/create')
    const sel = (id: string) =>
      w
        .findAllComponents(USelect)
        .find(
          (c) => c.element.matches(`[data-testid=${id}]`) || c.find(`[data-testid=${id}]`).exists(),
        )
    sel('field-classroom')?.vm.$emit('update:modelValue', '9')
    sel('field-subject')?.vm.$emit('update:modelValue', '3')
    sel('field-level')?.vm.$emit('update:modelValue', '11')
    await flushPromises()
    await t(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(hc.createHeadcount.mock.calls[0]?.[0]).toMatchObject({
      classroomId: '9',
      subjectId: '3',
      educationLevelId: '11',
      academicYear: 2026,
    })
  })
})

describe('headcount: uniform 404 (privacy OQ-3)', () => {
  const cell = { target: null, targetGrade: null, ar: null, arGrade: null, tone: 'na' }
  const pupil = (userId: string | null, name: string) => ({
    userId,
    name,
    tov: null,
    tovGrade: null,
    cells: [cell],
    etr: null,
    etrGrade: null,
    dropped: false,
  })
  const DETAIL = {
    config: {
      id: '501',
      subject: 'Kimia',
      className: '5 A',
      levelName: 'Tingkatan 5',
      year: 2026,
      teacherName: 'Guru Demo',
      status: 'active',
      activeOtrs: 1,
    },
    chips: { onTrack: 0, below: 0, empty: 2, total: 2 },
    rows: [pupil('11', 'Murid A'), pupil(null, 'Murid B.')],
    averages: { tov: null, otrs: [null], ars: [null], etr: null },
  } as unknown as HeadcountDetail

  it.each([
    ['table', HeadcountTablePage, '/headcount/9', '/headcount/:id', 'fetchHeadcountDetail'],
    [
      'summary',
      HeadcountSummaryPage,
      '/headcount/9/summary',
      '/headcount/:id/summary',
      'fetchHeadcountSummary',
    ],
    [
      'student',
      HeadcountStudentPage,
      '/headcount/student/9',
      '/headcount/student/:id',
      'fetchHeadcountStudent',
    ],
  ] as const)(
    'a 404 on the %s page is the not-found page, not a load error',
    async (_n, page, path, route, fn) => {
      hc[fn].mockRejectedValue(apiError(404))
      const w = await render(page, path, route)
      expect(useRouteOutcome().value).toBe(404)
      expect(w.find('[data-testid=page-error]').exists()).toBe(false)
    },
  )

  it('a 404 on the CSV export page is the not-found page', async () => {
    hc.downloadHeadcountCsv.mockRejectedValue(apiError(404))
    const w = await render(HeadcountExportPage, '/headcount/9/export', '/headcount/:id/export')
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-testid=page-error]').exists()).toBe(false)
  })

  it('a 404 on delete turns the page into the not-found page', async () => {
    hc.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    hc.deleteHeadcount.mockRejectedValue(apiError(404))
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    await t(w, 'action-delete').trigger('click')
    await flushPromises()
    body('delete-confirm')?.click()
    await flushPromises()
    expect(hc.deleteHeadcount).toHaveBeenCalledWith('501')
    expect(useRouteOutcome().value).toBe(404)
  })

  it('a 500 on delete keeps the page (no not-found outcome)', async () => {
    hc.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    hc.deleteHeadcount.mockRejectedValue(apiError(500))
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    await t(w, 'action-delete').trigger('click')
    await flushPromises()
    body('delete-confirm')?.click()
    await flushPromises()
    expect(useRouteOutcome().value).toBeNull()
  })

  it('a 404 on delete in mock mode stays a load error (mock answers 403 out of scope)', async () => {
    vi.unstubAllEnvs()
    hc.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    hc.deleteHeadcount.mockRejectedValue(apiError(404))
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    await t(w, 'action-delete').trigger('click')
    await flushPromises()
    body('delete-confirm')?.click()
    await flushPromises()
    expect(useRouteOutcome().value).toBeNull()
  })

  it('Gugurkan sends string ids; a masked row (userId null) is plain text and not selectable', async () => {
    hc.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    hc.dropHeadcountStudents.mockResolvedValue({ updated: 1 })
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    expect(w.find('[data-testid=row-masked]').exists()).toBe(true)
    expect(w.find('[data-testid=select-null]').exists()).toBe(false)
    expect(w.find('a[href="/headcount/student/null"]').exists()).toBe(false)
    await w.get('[data-testid=select-all]').trigger('click')
    await t(w, 'drop-students').trigger('click')
    await flushPromises()
    expect(hc.dropHeadcountStudents).toHaveBeenCalledWith('501', {
      action: 'drop',
      studentIds: ['11'],
    })
  })
})

describe('masked names: userId null', () => {
  it('the ranking lists a null-userId row as plain text without a link', async () => {
    const rows: Ranking['rows'] = [1, 2].map((rank) => ({
      rank,
      userId: null,
      name: 'Aina K.',
      schoolName: 'SMK Contoh',
      tahap: 3,
      correct: 10,
      accuracy: 80,
    }))
    perf.fetchRankings.mockResolvedValue({
      scope: 'nasional',
      title: 'x',
      showFooter: false,
      states: [],
      rows,
      total: 2,
    })
    const w = await render(RankingPage, '/ranking')
    expect(w.findAll('[data-testid=ranking-name]')).toHaveLength(2)
    expect(w.html()).not.toContain('/pelajar/')
    expect(w.html()).not.toContain('/prestasi/')
  })

  it('the leaderboard and podium accept null-userId rows, including equal ranks', async () => {
    const row = (rank: number): Leaderboard['rows'][number] => ({
      rank,
      userId: null,
      name: 'Aina K.',
      avatarUrl: null,
      coins: 100,
      sessions: 2,
      accuracy: 70,
    })
    perf.fetchLeaderboard.mockResolvedValue({
      period: 'week',
      me: { rank: null, coins: 0, sessions: 0, accuracy: 0 },
      rows: [row(1), row(2), row(2), row(4)],
      participants: 4,
    })
    const w = await render(LeaderboardPage, '/leaderboard')
    expect(w.findAll('[data-testid=podium-name]')).toHaveLength(3)
    expect(w.findAll('[data-testid=row-name]')).toHaveLength(4)
    expect(w.html()).not.toContain('/prestasi/')
  })
})

describe('public profile and timeline', () => {
  const profile = {
    id: '1042',
    name: 'Aina K',
    firstName: 'Aina',
    schoolName: null,
    levelName: 'Tingkatan 4',
    joinedAt: '2025-10-25T20:00:00+08:00',
    daysWith: 3,
    tier: {
      key: 'bronze',
      name: 'Gangsa',
      emoji: '🥉',
      level: 1,
      ordinal: 1,
      progressPct: 10,
      toNext: null,
      nextName: null,
      nextKey: null,
    },
    syiling: 0,
    streak: { current: 0, best: 0 },
    accuracy: 0,
    activity: { sessions: 0, practiceDays: 0, correct: 0, bestStreak: 0 },
    posts: [],
  } as unknown as PublicProfile

  it('posts: [] renders the profile with the Timeline empty state and no error', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    perf.fetchPublicProfile.mockResolvedValue(profile)
    const w = await render(PublicProfilePage, '/pelajar/1042', '/pelajar/:id')
    vi.unstubAllEnvs()
    expect(w.find('[data-testid=profile-card]').exists()).toBe(true)
    expect(w.get('[data-testid=profile-posts]').text()).toContain('Tiada catatan lagi.')
    expect(w.find('[data-testid=page-error]').exists()).toBe(false)
  })

  it('timeline photos from /api/files show as they are (same origin)', async () => {
    perf.fetchTimeline.mockResolvedValue({
      profileUrl: '/pelajar/1042',
      posts: [
        {
          id: '5',
          userId: '1042',
          title: 'Sijil',
          category: 'sijil',
          eventDate: null,
          story: null,
          photos: [{ url: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg', caption: null }],
          createdAt: '2026-08-15T09:00:00+08:00',
        },
      ],
    })
    const w = await render(TimelinePage, '/timeline')
    expect(w.get('[data-testid=post-photo]').attributes('src')).toBe(
      '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg',
    )
  })
})
