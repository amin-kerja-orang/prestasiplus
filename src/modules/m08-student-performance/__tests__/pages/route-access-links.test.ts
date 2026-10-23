// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import type { Role } from '@/stores/session-types'

import type { LevelDetail, StudentPerformance, Timeline } from '../../api/types'
import HeadcountCards from '../../components/prestasi360/HeadcountCards.vue'
import TimelinePage from '../../pages/TimelinePage.vue'
import TingkatanPage from '../../pages/TingkatanPage.vue'

/**
 * SWP-1..3 (DV-M08-47, DV-M08-48): an in-page link is rendered only when the viewer's role can open
 * its target, so a pupil never meets a 404, a 403 or the "Belum tersedia" page from a card.
 */
const api = vi.hoisted(() => ({ fetchTimeline: vi.fn(), fetchLevelDetail: vi.fn() }))
vi.mock('../../api/performance', () => api)

const session = vi.hoisted(() => ({ role: null as string | null }))
vi.mock('@/stores/session', () => ({ useSessionStore: () => session }))

const STAFF: Role[] = ['admin', 'teacher', 'school_admin']
const stub = { template: '<div />' }

const T4: LevelDetail = {
  code: 't4',
  name: 'Tingkatan 4',
  classes: 1,
  students: 53,
  subjects: 1,
  accuracy: 51.3,
  sessions: 7,
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
  ],
  topStudents: [],
  atRisk: [],
}

const CARDS: StudentPerformance['headcount'] = [
  {
    configId: 504,
    subject: 'Sejarah',
    className: '5 MARIKH - Sejarah',
    year: 2026,
    status: 'below',
    tov: 50,
    chips: [
      { label: 'TOV', value: 50, tone: 'none' },
      { label: 'ETR', value: 65, tone: 'none' },
    ],
    etr: 65,
  },
]

let wrapper: VueWrapper | null = null

/** The real route metas that matter here: the class and headcount screens are staff only. */
const guarded = (path: string): RouteRecordRaw => ({
  path,
  component: stub,
  meta: { roles: STAFF },
})

async function mountAt(component: object, path: string, route: string, props = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: route, component: stub },
      guarded('/prestasi/kelas/:id(\\d+)'),
      guarded('/headcount/student/:id(\\d+)'),
      { path: '/pelajar/:id(\\d+)', component: stub },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { props, global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchTimeline.mockReset()
  api.fetchLevelDetail.mockReset()
  api.fetchLevelDetail.mockResolvedValue(T4)
  session.role = null
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllEnvs()
})

describe('SWP-2 TingkatanPage "Lihat →"', () => {
  const links = (w: VueWrapper) =>
    w.findAll('a[href="/prestasi/kelas/5"]').filter((a) => a.text().includes('Lihat'))

  it('shows no class link to a pupil', async () => {
    session.role = 'student'
    const w = await mountAt(TingkatanPage, '/prestasi/tingkatan/t4', '/prestasi/tingkatan/:code')
    expect(w.text()).toContain('4 Cemerlang - BM')
    expect(links(w)).toHaveLength(0)
  })

  it.each(STAFF)('keeps the class link for %s', async (role) => {
    session.role = role
    const w = await mountAt(TingkatanPage, '/prestasi/tingkatan/t4', '/prestasi/tingkatan/:code')
    expect(links(w).length).toBeGreaterThan(0)
  })
})

describe('SWP-3 HeadcountCards "Lihat Penuh"', () => {
  it('is hidden from a pupil but the card stays', async () => {
    session.role = 'student'
    const w = await mountAt(HeadcountCards, '/prestasi/47', '/prestasi/:id', {
      userId: 47,
      cards: CARDS,
    })
    expect(w.find('[data-testid=headcount-504]').exists()).toBe(true)
    expect(w.find('a[href="/headcount/student/47"]').exists()).toBe(false)
  })

  it('is shown to a teacher', async () => {
    session.role = 'teacher'
    const w = await mountAt(HeadcountCards, '/prestasi/47', '/prestasi/:id', {
      userId: 47,
      cards: CARDS,
    })
    const link = w.get('a[href="/headcount/student/47"]')
    expect(link.text()).toContain('Lihat Penuh')
  })
})

describe('SWP-1 TimelinePage "Profil Awam Anda"', () => {
  const TL: Timeline = { profileUrl: '/pelajar/47', posts: [] }

  beforeEach(() => {
    api.fetchTimeline.mockResolvedValue(TL)
  })

  it('hides the whole public-profile box when the scope keeps the profile away from the role', async () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    session.role = 'student'
    const w = await mountAt(TimelinePage, '/timeline', '/timeline')
    expect(w.find('[data-testid=timeline-page]').exists()).toBe(true)
    expect(w.find('[data-testid=add-post]').exists()).toBe(true)
    expect(w.find('[data-testid=public-profile-box]').exists()).toBe(false)
    expect(w.find('[data-testid=public-url]').exists()).toBe(false)
    expect(w.find('[data-testid=copy-url]').exists()).toBe(false)
    expect(w.text()).not.toContain('Profil Awam Anda')
  })

  it('shows the link and the copy button when the role may open the profile', async () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    session.role = 'admin'
    const w = await mountAt(TimelinePage, '/timeline', '/timeline')
    expect(w.get('[data-testid=public-url]').attributes('href')).toBe(
      `${window.location.origin}/pelajar/47`,
    )
    expect(w.find('[data-testid=copy-url]').exists()).toBe(true)
  })

  it('shows the box with the scope off (the e2e build) and hides it when the route is not built', async () => {
    session.role = 'student'
    const w = await mountAt(TimelinePage, '/timeline', '/timeline')
    expect(w.find('[data-testid=public-profile-box]').exists()).toBe(true)
    w.unmount()
    wrapper = null

    api.fetchTimeline.mockResolvedValue({ profileUrl: '/tidak-wujud/47', posts: [] })
    const w2 = await mountAt(TimelinePage, '/timeline', '/timeline')
    expect(w2.find('[data-testid=public-profile-box]').exists()).toBe(false)
  })
})
