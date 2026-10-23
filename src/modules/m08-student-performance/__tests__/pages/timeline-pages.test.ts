// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'

import type { PublicProfile, Timeline, TimelinePost } from '../../api/types'
import PublicProfilePage from '../../pages/PublicProfilePage.vue'
import TimelineCreatePage from '../../pages/TimelineCreatePage.vue'
import TimelinePage from '../../pages/TimelinePage.vue'

const api = vi.hoisted(() => ({
  fetchTimeline: vi.fn(),
  fetchPublicProfile: vi.fn(),
  createTimelinePost: vi.fn(),
}))
vi.mock('../../api/performance', () => api)

const dialogs = vi.hoisted(() => ({ alertNative: vi.fn() }))
const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/composables', async (orig) => ({
  ...(await orig<object>()),
  useToast: () => toast,
}))
vi.mock('@/components/overlay/native-dialogs', () => dialogs)

const post = (over: Partial<TimelinePost> = {}): TimelinePost => ({
  id: 1,
  userId: 2,
  title: 'Sijil <b>Matematik</b>',
  category: 'sijil',
  eventDate: '2026-08-14',
  story: '<img src=x onerror=alert(1)> cerita',
  photos: [{ url: 'blob:mock/a.png', caption: 'Gambar satu' }],
  createdAt: '2026-08-15T09:00:00+08:00',
  ...over,
})

const profile = (over: Partial<PublicProfile> = {}): PublicProfile => ({
  id: 1,
  name: 'Admin Demo',
  firstName: 'Admin',
  schoolName: 'SK Demo',
  levelName: 'Darjah 6',
  joinedAt: '2025-10-25T20:00:00+08:00',
  daysWith: 334,
  tier: {
    key: 'bronze',
    name: 'Gangsa',
    emoji: '🥉',
    level: 2,
    ordinal: 1,
    progressPct: 51.2,
    toNext: 244,
    nextName: 'Perak',
    nextKey: 'silver',
  },
  syiling: 256,
  streak: { current: 1, best: 5 },
  accuracy: 0,
  activity: { sessions: 0, practiceDays: 0, correct: 0, bestStreak: 5 },
  posts: [],
  ...over,
})

let wrapper: VueWrapper | null = null
let router: Router

async function render(
  component: object,
  path: string,
  routePath: string,
  extraRoutes: RouteRecordRaw[] = [],
): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, component },
      { path: '/timeline', component: { template: '<i />' } },
      ...extraRoutes,
    ],
  })
  await router.push(path)
  wrapper = mount(component, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((m) => m.mockReset())
  dialogs.alertNative.mockReset()
  toast.add.mockReset()
  const t: Timeline = { profileUrl: '/pelajar/1', posts: [] }
  api.fetchTimeline.mockResolvedValue(t)
  api.fetchPublicProfile.mockResolvedValue(profile())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('S16 TimelinePage', () => {
  it('shows the empty card, the add links and the own public link', async () => {
    const w = await render(TimelinePage, '/timeline', '/timeline')
    expect(w.get('h1').text()).toBe('📸 Timeline Saya')
    expect(w.get('[data-testid=timeline-empty]').text()).toContain('Timeline Kosong')
    expect(w.get('[data-testid=add-post]').attributes('href')).toBe('/timeline/create')
    expect(w.get('[data-testid=add-first]').text()).toBe('Tambah Post Pertama')
    const link = w.get('[data-testid=public-url]')
    expect(link.attributes('href')).toBe(`${window.location.origin}/pelajar/1`)
    expect(link.attributes('target')).toBe('_blank')
  })

  it('swaps the copy icon for 2,000ms and renders post text as text only', async () => {
    api.fetchTimeline.mockResolvedValue({
      profileUrl: '/pelajar/2',
      posts: [post(), post({ id: 2, title: 'Baru', eventDate: '2026-09-05' })],
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = await render(TimelinePage, '/timeline', '/timeline')
    const titles = w.findAll('[data-testid=post-title]').map((t) => t.text())
    expect(titles).toEqual(['Baru', 'Sijil <b>Matematik</b>'])
    expect(w.find('[data-testid=post-story] img').exists()).toBe(false)
    expect(w.findAll('[data-testid=post-photo]')[0]?.attributes('src')).toContain('data:image/svg')

    vi.useFakeTimers()
    await w.get('[data-testid=copy-url]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pelajar/2`)
    expect(w.get('[data-testid=copy-url]').attributes('data-copied')).toBe('true')
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(w.get('[data-testid=copy-url]').attributes('data-copied')).toBe('false')
  })
})

describe('S17 TimelineCreatePage', () => {
  it('has the live fields, defaults and limits', async () => {
    const w = await render(TimelineCreatePage, '/timeline/create', '/timeline/create')
    expect(w.get('h1').text()).toBe('📸 Post Baru')
    const title = w.get('input[name=title]')
    expect(title.attributes('maxlength')).toBe('150')
    expect(title.attributes('required')).toBeDefined()
    expect(title.attributes('placeholder')).toBe('cth: Sijil Kecemerlangan Matematik 2026')
    expect((w.get('select[name=category]').element as HTMLSelectElement).value).toBe('cerita')
    expect(w.get('textarea').attributes('maxlength')).toBe('2000')
    const file = w.get('[data-testid=photo-input]')
    expect(file.attributes('accept')).toBe('image/jpeg,image/png,image/webp')
    expect(file.attributes('required')).toBeUndefined()
    expect(w.get('[data-testid=cancel]').attributes('href')).toBe('/timeline')
  })

  it('previews files, alerts for a 2 MB+ file and keeps captions (DV-30)', async () => {
    const w = await render(TimelineCreatePage, '/timeline/create', '/timeline/create')
    URL.createObjectURL = vi.fn(() => 'blob:test/preview')
    URL.revokeObjectURL = vi.fn()
    const mk = (n: string, size = 10) => new File([new Uint8Array(size)], n, { type: 'image/png' })
    const input = w.get('[data-testid=photo-input]')
    Object.defineProperty(input.element, 'files', {
      value: [mk('a.png'), mk('big.png', 3 * 1024 * 1024), mk('b.png')],
      configurable: true,
    })
    await input.trigger('change')
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'big.png terlalu besar (maks 2MB)' }),
    )
    expect(w.findAll('[data-testid=photo-preview]')).toHaveLength(2)
    const caps = w.findAll('[data-testid=caption-input]')
    expect(caps[1]?.attributes('placeholder')).toBe('Keterangan gambar 2...')
    expect(caps[0]?.attributes('maxlength')).toBe('200')
    await caps[0]?.setValue('satu')
    await caps[1]?.setValue('dua')
    await w.findAll('[data-testid=photo-remove]')[0]?.trigger('click')
    const left = w.findAll('[data-testid=caption-input]')
    expect(left).toHaveLength(1)
    expect((left[0]?.element as HTMLInputElement).value).toBe('dua')
  })

  it('releases a preview URL on remove and on unmount', async () => {
    const revoke = vi.fn()
    URL.createObjectURL = vi.fn(() => 'blob:test/preview')
    URL.revokeObjectURL = revoke
    const w = await render(TimelineCreatePage, '/timeline/create', '/timeline/create')
    const input = w.get('[data-testid=photo-input]')
    const file = (n: string) => new File([new Uint8Array(4)], n, { type: 'image/png' })
    Object.defineProperty(input.element, 'files', {
      value: [file('a.png'), file('b.png')],
      configurable: true,
    })
    await input.trigger('change')
    await w.findAll('[data-testid=photo-remove]')[0]?.trigger('click')
    expect(revoke).toHaveBeenCalledTimes(1)
    w.unmount()
    wrapper = null
    expect(revoke).toHaveBeenCalledTimes(2)
  })

  it('disables "Terbitkan" while the request is in flight', async () => {
    let finish: (v: TimelinePost) => void = () => undefined
    api.createTimelinePost.mockReturnValueOnce(new Promise<TimelinePost>((r) => (finish = r)))
    const w = await render(TimelineCreatePage, '/timeline/create', '/timeline/create')
    await w.get('input[name=title]').setValue('Tajuk')
    await w.get('form').trigger('submit')
    expect(w.get('[data-testid=submit]').attributes('disabled')).toBeDefined()
    await w.get('form').trigger('submit')
    expect(api.createTimelinePost).toHaveBeenCalledTimes(1)
    finish(post())
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/timeline')
  })
  it('goes to /timeline on success; a 422 shows the message and keeps the values', async () => {
    const { ApiError } = await import('@/api')
    api.createTimelinePost.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { photos: 'Sila muat naik sekurang-kurangnya 1 gambar.' },
      }),
    )
    const w = await render(TimelineCreatePage, '/timeline/create', '/timeline/create')
    await w.get('input[name=title]').setValue('Tajuk saya')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Sila muat naik sekurang-kurangnya 1 gambar.')
    expect((w.get('input[name=title]').element as HTMLInputElement).value).toBe('Tajuk saya')
    expect(router.currentRoute.value.path).toBe('/timeline/create')

    api.createTimelinePost.mockResolvedValueOnce(post())
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.createTimelinePost).toHaveBeenCalledTimes(2)
    expect(router.currentRoute.value.path).toBe('/timeline')
  })
})

describe('S18 PublicProfilePage', () => {
  const render18 = () => render(PublicProfilePage, '/pelajar/1', '/pelajar/:id')

  it('shows the profile card, tier card, activity, stat cards, sponsor CTA and footer', async () => {
    const w = await render18()
    expect(api.fetchPublicProfile).toHaveBeenCalledWith(1, expect.anything())
    expect(w.get('[data-testid=name]').text()).toBe('Admin Demo')
    expect(w.get('[data-testid=tier-pill]').text()).toBe('🥉 Bronze')
    expect(w.get('[data-testid=chip-school]').text()).toBe('SK Demo')
    expect(w.get('[data-testid=chip-level]').text()).toBe('Darjah 6')
    expect(w.get('[data-testid=chip-joined]').text()).toBe('Ahli sejak 25 Oktober 2025')
    expect(w.get('[data-testid=days-with]').text()).toBe('334 hari bersama')
    expect(w.get('[data-testid=coin-value]').text()).toBe('256')
    expect(w.get('[data-testid=tier-next]').text()).toBe('244 syiling lagi ke Silver')
    expect(w.get('[data-testid=tier-card]').text()).toContain('Tahap 1')
    expect(w.findAll('[data-testid=summary-item]').map((s) => s.text())).toEqual([
      '0 sesi latihan',
      '0 hari berlatih',
      '0 jawapan betul',
      '5 kombo terpanjang',
    ])
    expect(w.findAll('[data-testid=stat-cards] > li').map((s) => s.text())).toEqual([
      '256Syiling',
      '1Kombo Hari',
      '0Sesi Latihan',
      '0%Ketepatan',
    ])
    // D4 (23 Oct sweep): no `/sponsor/register` route is registered, so the CTA panel is hidden (not a 404 link).
    expect(w.find('[data-testid=sponsor-cta]').exists()).toBe(false)
    expect(w.get('[data-testid=footer-line]').text()).toBe('Teruskan usaha Admin!')
    expect(w.find('[data-testid=profile-posts]').exists()).toBe(false)
  })

  it('shows the sponsor CTA linking to /sponsor/register once that route exists', async () => {
    const w = await render(PublicProfilePage, '/pelajar/1', '/pelajar/:id', [
      { path: '/sponsor/register', component: { template: '<i />' } },
    ])
    expect(w.get('[data-testid=sponsor-link]').attributes('href')).toBe('/sponsor/register')
  })

  it('shows posts as text only', async () => {
    api.fetchPublicProfile.mockResolvedValue(profile({ posts: [post()] }))
    const w = await render18()
    expect(w.get('[data-testid=profile-posts] [data-testid=post-title]').text()).toBe(
      'Sijil <b>Matematik</b>',
    )
    expect(w.find('[data-testid=profile-posts] b').exists()).toBe(false)
  })

  it('"Kongsi" copies and alerts when navigator.share is missing, else shares', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const w = await render18()
    await w.get('[data-testid=share]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pelajar/1`)
    expect(dialogs.alertNative).toHaveBeenCalledWith('Link disalin!')

    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    dialogs.alertNative.mockReset()
    await w.get('[data-testid=share]').trigger('click')
    await flushPromises()
    expect(share).toHaveBeenCalledWith({
      title: 'Admin Demo',
      url: `${window.location.origin}/pelajar/1`,
    })
    expect(dialogs.alertNative).not.toHaveBeenCalled()
  })
})
