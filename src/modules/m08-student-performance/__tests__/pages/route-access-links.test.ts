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
import classRoutes from '../../routes/class'
import headcountRoutes from '../../routes/headcount'
import timelineRoutes from '../../routes/timeline'

/**
 * SWP-1..3 (DV-M08-47, DV-M08-48): an in-page link is rendered only when the viewer's role can open
 * its target, so a pupil never meets a 404, a 403 or the "Belum tersedia" page from a card.
 */
const api = vi.hoisted(() => ({ fetchTimeline: vi.fn(), fetchLevelDetail: vi.fn() }))
vi.mock('../../api/performance', () => api)

// Like the real store, it cannot be used without an active Pinia (so a test can prove it is not touched).
const session = vi.hoisted(() => ({ role: null as string | null }))
vi.mock('@/stores/session', async () => {
  const { getActivePinia } = await import('pinia')
  return {
    useSessionStore: () => {
      if (!getActivePinia()) throw new Error('getActivePinia() was called but there is no active Pinia')
      return session
    },
  }
})

const STAFF: Role[] = ['admin', 'teacher', 'school_admin']
const NO_PINIA_ROLE: Role = 'teacher'
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

/**
 * The REAL M08 route records (class, headcount and timeline fragments), so a change of their `meta.roles`
 * is caught here. Only the lazy page components are swapped for a stub; the host pages get a plain route.
 */
const realRoutes: RouteRecordRaw[] = [...classRoutes, ...headcountRoutes, ...timelineRoutes].map(
  (r) => ({ ...r, component: stub }) as RouteRecordRaw,
)

/** `wide` is the `(min-width: 768px)` query: the class table on desktop, the cards below it. */
function setWide(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide && query.includes('min-width'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  }))
}

async function mountAt(component: object, path: string, route: string, props = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...(realRoutes.some((r) => r.path === route) ? [] : [{ path: route, component: stub }]),
      ...realRoutes,
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
  vi.unstubAllGlobals()
})

describe('SWP-2 TingkatanPage "Lihat →"', () => {
  const links = (w: VueWrapper) =>
    w.findAll('a[href="/prestasi/kelas/5"]').filter((a) => a.text().includes('Lihat'))
  const headers = (w: VueWrapper) => w.findAll('th').map((th) => th.text())
  const open = () => mountAt(TingkatanPage, '/prestasi/tingkatan/t4', '/prestasi/tingkatan/:code')

  it('shows no class link to a pupil', async () => {
    session.role = 'student'
    const w = await open()
    expect(w.text()).toContain('4 Cemerlang - BM')
    expect(links(w)).toHaveLength(0)
  })

  it('drops the "Aksi" column when no row can be opened (pupil)', async () => {
    session.role = 'student'
    const w = await open()
    expect(headers(w)).toContain('Kelas')
    expect(headers(w)).not.toContain('Aksi')
  })

  it.each(STAFF)('keeps the class link and the "Aksi" column for %s', async (role) => {
    session.role = role
    const w = await open()
    expect(links(w).length).toBeGreaterThan(0)
    expect(headers(w)).toContain('Aksi')
  })

  it('shows no link, column or empty action area to a pupil in the card layout', async () => {
    setWide(false)
    session.role = 'student'
    const w = await open()
    expect(w.find('[data-ds=data-table-cards]').exists()).toBe(true)
    expect(w.text()).toContain('4 Cemerlang - BM')
    expect(links(w)).toHaveLength(0)
    expect(w.find('[data-ds=data-table-cards] li a').exists()).toBe(false)
  })

  it('keeps the card link for a teacher in the card layout', async () => {
    setWide(false)
    session.role = 'teacher'
    const w = await open()
    expect(links(w).length).toBeGreaterThan(0)
  })

  it('shows no link and no "Aksi" column when nobody is signed in (role null)', async () => {
    session.role = null
    const w = await open()
    expect(w.text()).toContain('4 Cemerlang - BM')
    expect(links(w)).toHaveLength(0)
    expect(headers(w)).not.toContain('Aksi')
  })

  describe('with the prototype scope ON', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    })

    it('shows a pupil no link and no "Aksi" column', async () => {
      session.role = 'student'
      const w = await open()
      expect(links(w)).toHaveLength(0)
      expect(headers(w)).not.toContain('Aksi')
    })

    it('shows no link with a null role', async () => {
      session.role = null
      const w = await open()
      expect(links(w)).toHaveLength(0)
      expect(headers(w)).not.toContain('Aksi')
    })

    it('keeps the link and the column for a teacher the scope lets in', async () => {
      session.role = 'teacher'
      const w = await open()
      expect(links(w).length).toBeGreaterThan(0)
      expect(headers(w)).toContain('Aksi')
    })
  })

  it('fails closed without an active Pinia: the role is unknown, so a staff-only link is hidden', async () => {
    session.role = NO_PINIA_ROLE
    setActivePinia(undefined)
    const w = await open()
    expect(w.text()).toContain('4 Cemerlang - BM')
    expect(links(w)).toHaveLength(0)
    expect(headers(w)).not.toContain('Aksi')
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

  it('is hidden when nobody is signed in (role null), the card stays', async () => {
    session.role = null
    const w = await mountAt(HeadcountCards, '/prestasi/47', '/prestasi/:id', {
      userId: 47,
      cards: CARDS,
    })
    expect(w.find('[data-testid=headcount-504]').exists()).toBe(true)
    expect(w.find('a[href="/headcount/student/47"]').exists()).toBe(false)
  })

  it.each([
    ['student', false],
    ['teacher', true],
    [null, false],
  ])('with the prototype scope ON, role %s sees the link: %s', async (role, visible) => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    session.role = role
    const w = await mountAt(HeadcountCards, '/prestasi/47', '/prestasi/:id', {
      userId: 47,
      cards: CARDS,
    })
    expect(w.find('[data-testid=headcount-504]').exists()).toBe(true)
    expect(w.find('a[href="/headcount/student/47"]').exists()).toBe(visible)
  })

  it('fails closed without an active Pinia (scope on or off)', async () => {
    session.role = NO_PINIA_ROLE
    setActivePinia(undefined)
    for (const scope of ['off', 'on']) {
      vi.stubEnv('VITE_PROTOTYPE_SCOPE', scope)
      const w = await mountAt(HeadcountCards, '/prestasi/47', '/prestasi/:id', {
        userId: 47,
        cards: CARDS,
      })
      expect(w.find('a[href="/headcount/student/47"]').exists(), `scope ${scope}`).toBe(false)
      w.unmount()
      wrapper = null
    }
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
