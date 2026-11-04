// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import USelect from '@nuxt/ui/components/Select.vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'
import { useSessionStore } from '@/stores/session'

import type { VideoCard, VideoDetail } from '../../api/types'
import VideoDetailPage from '../../pages/VideoDetailPage.vue'
import VideoFormPage from '../../pages/VideoFormPage.vue'
import VideoListPage from '../../pages/VideoListPage.vue'

const api = vi.hoisted(() => ({
  fetchVideos: vi.fn(),
  fetchVideo: vi.fn(),
  createVideo: vi.fn(),
  updateVideo: vi.fn(),
  deleteVideo: vi.fn(),
  fetchVideoFormContext: vi.fn(),
}))
vi.mock('../../api/content', () => api)

const editApi = vi.hoisted(() => ({ fetchVideoForEdit: vi.fn() }))
vi.mock('../../lib/video-edit-api', () => editApi)

const media = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../api/admin-media', () => media)

const dialogs = vi.hoisted(() => ({ confirmNative: vi.fn(() => true), alertNative: vi.fn() }))
vi.mock('@/components/overlay/native-dialogs', () => dialogs)

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))

/** A mounted component, seen only through its props and emitted v-model. */
interface Probe {
  props: (key: string) => unknown
  vm: { $emit: (event: string, value: unknown) => void }
}

const g = globalThis as { ResizeObserver?: unknown }
g.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const stub = { template: '<div />' }

function card(id: number, extra: Partial<VideoCard> = {}): VideoCard {
  return {
    id,
    title: `Video ${String(id)}`,
    platformLabel: 'YouTube',
    thumbnailUrl: `https://img.youtube.com/vi/ID${String(id)}/hqdefault.jpg`,
    views: 10 + id,
    createdAt: '2026-03-03T10:00:00+08:00',
    uploader: { name: 'Admin Demo', initial: 'A', roleLabel: 'admin' },
    ...extra,
  }
}

function detail(id: number, extra: Partial<VideoDetail> = {}): VideoDetail {
  return {
    ...card(id),
    videoUrl: 'https://www.youtube.com/watch?v=abc123XYZ00',
    embedUrl: 'https://www.youtube.com/embed/abc123XYZ00',
    platform: 'Youtube',
    description: 'Baris satu\nBaris dua',
    category: 'ceramah',
    categoryLabel: 'Ceramah',
    subject: { id: 5, name: 'Sejarah' },
    visibility: 'global',
    canManage: true,
    related: [card(99, { title: 'Berkaitan' })],
    ...extra,
  }
}

const FACETS = {
  total: 2260,
  categories: [
    { code: 'motivasi', label: 'Motivasi', count: 3 },
    { code: 'tutorial', label: 'Tutorial', count: 12 },
    { code: 'lain-lain', label: 'Lain-lain', count: 0 },
  ],
  subjects: [
    { id: 3, name: 'Matematik', count: 865 },
    { id: 5, name: 'Sejarah', count: 97 },
  ],
}

function listResult(rows: VideoCard[], total = rows.length) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 24,
      totalItems: total,
      totalPages: Math.ceil(total / 24),
      from: 1,
      to: rows.length,
      facets: FACETS,
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function mountAt(component: object, path: string, props: Record<string, unknown> = {}) {
  wrapper?.unmount()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/video', component: stub },
      { path: '/video/tambah', component: stub },
      { path: '/video/:id', component: stub },
      { path: '/video/:id/edit', component: stub },
      { path: '/dashboard', component: stub },
      { path: '/page', component },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

/** Reka selects / radios are not native: drive them through their v-model. */
const category = (w: VueWrapper) => w.findAllComponents(USelect)[0]! as unknown as Probe
const subject = (w: VueWrapper) => w.findAllComponents(USelect)[1]! as unknown as Probe

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  editApi.fetchVideoForEdit.mockReset()
  media.fetchSubjectOptions.mockReset().mockResolvedValue({
    data: [
      { id: 5, name: 'Sejarah' },
      { id: 3, name: 'Matematik' },
    ],
  })
  dialogs.confirmNative.mockReset().mockReturnValue(true)
  outcome.setRouteOutcome.mockReset()
  api.fetchVideoFormContext.mockResolvedValue({
    uploader: { name: 'Admin Demo', initial: 'A', roleLabel: 'admin' },
    school: null,
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function login(role: 'admin' | 'student' | 'teacher' | 'school_admin' = 'student') {
  useSessionStore().setSession({
    token: 't',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: { id: 2, role, landingPath: '/dashboard' } as never,
  })
}

describe('VideoListPage (S17)', () => {
  beforeEach(() => {
    api.fetchVideos.mockResolvedValue(listResult([card(1), card(2)], 50))
  })

  it('logged in: pills, add button, cards and pager', async () => {
    login('admin')
    const w = await mountAt(VideoListPage, '/page')
    expect(w.find('[data-testid="video-guest-hero"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="video-category-pill"]').map((p) => p.text())).toEqual([
      'Semua (2260)',
      'Motivasi (3)',
      'Tutorial (12)',
      'Lain-lain (0)',
    ])
    expect(t(w, 'video-add').attributes('href')).toBe('/video/tambah')
    expect(w.findAll('[data-testid="video-card"]')).toHaveLength(2)
    expect(t(w, 'video-card').text()).toContain('11 tontonan')
    expect(w.find('[data-testid="video-pager"]').exists()).toBe(true)
    expect(t(w, 'video-search').attributes('placeholder')).toBe('Cari video...')
  })

  it.each([
    ['student', false],
    ['school_admin', false],
    ['teacher', true],
    ['admin', true],
  ] as const)('"Tambah Video" for %s: %s', async (role, shown) => {
    login(role)
    const w = await mountAt(VideoListPage, '/page')
    expect(w.find('[data-testid="video-add"]').exists()).toBe(shown)
  })

  it('pills sit on one scrollable row and are at least 44 px tall', async () => {
    login()
    const w = await mountAt(VideoListPage, '/page')
    const nav = t(w, 'video-category-pills')
    expect(nav.classes()).toEqual(expect.arrayContaining(['flex-nowrap', 'overflow-x-auto']))
    for (const pill of w.findAll('[data-testid="video-category-pill"]')) {
      expect(pill.classes()).toContain('min-h-11')
    }
  })

  it('the grid has 1, 2 and 3 columns only', async () => {
    login()
    const w = await mountAt(VideoListPage, '/page')
    const cls = t(w, 'video-grid').classes()
    expect(cls).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3']))
    expect(cls).not.toContain('xl:grid-cols-4')
  })

  it('the pager shows Sebelum, Seterusnya and "Halaman {p} daripada {n}"', async () => {
    login()
    api.fetchVideos.mockResolvedValue({
      ...listResult([card(1), card(2)], 50),
      meta: { ...listResult([], 50).meta, totalPages: 3, page: 2 },
    })
    const w = await mountAt(VideoListPage, '/page?page=2')
    const pager = t(w, 'video-pager')
    expect(pager.text()).toContain('Sebelum')
    expect(pager.text()).toContain('Seterusnya')
    expect(t(w, 'video-page-text').text()).toBe('Halaman 2 daripada 3')
  })

  it('search is debounced 300 ms, keeps category and subject and resets the page', async () => {
    login()
    const w = await mountAt(VideoListPage, '/page?category=tutorial&subject=5&page=3')
    vi.useFakeTimers()
    try {
      await t(w, 'video-search').setValue('sejarah')
      await vi.advanceTimersByTimeAsync(299)
      expect(router.currentRoute.value.query.search).toBeUndefined()
      await vi.advanceTimersByTimeAsync(2)
    } finally {
      vi.useRealTimers()
    }
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/video?subject=5&category=tutorial&search=sejarah')
    expect(router.currentRoute.value.query.page).toBeUndefined()
  })

  it('shows the no-filter empty state, not the filtered one, when the library is empty', async () => {
    login()
    api.fetchVideos.mockResolvedValue(listResult([]))
    const w = await mountAt(VideoListPage, '/page')
    expect(t(w, 'video-empty-all').text()).toContain('Tiada video buat masa ini')
    expect(t(w, 'video-empty-all').text()).toContain('Video pembelajaran akan dipaparkan di sini')
    expect(w.find('[data-testid="video-empty"]').exists()).toBe(false)
  })

  it('a pill with count 0 is not a link; others link to ?category', async () => {
    login()
    const w = await mountAt(VideoListPage, '/page')
    const pills = w.findAll('[data-testid="video-category-pill"]')
    expect(pills[1]?.attributes('href')).toBe('/video?category=motivasi')
    expect(pills[3]?.element.tagName).toBe('BUTTON')
    expect(pills[3]?.attributes('href')).toBeUndefined()
  })

  it('builds subject-first category links and category-first subject links, with Reset Subjek', async () => {
    login()
    const w = await mountAt(VideoListPage, '/page?subject=5')
    const pills = w.findAll('[data-testid="video-category-pill"]')
    expect(pills[0]?.attributes('href')).toBe('/video?subject=5')
    expect(pills[1]?.attributes('href')).toBe('/video?subject=5&category=motivasi')
    expect(t(w, 'video-reset-subject').attributes('href')).toBe('/video')
    expect(api.fetchVideos.mock.calls[0]?.[0]).toMatchObject({ subject: 5 })

    const w2 = await mountAt(VideoListPage, '/page?category=tutorial')
    const subjects = w2.findAll('[data-testid="video-subject-pill"]')
    expect(subjects[1]?.attributes('href')).toBe('/video?category=tutorial&subject=5')
    expect(w2.find('[data-testid="video-reset-subject"]').exists()).toBe(false)
  })

  it('shows the empty state with "Lihat Semua Video"', async () => {
    login()
    api.fetchVideos.mockResolvedValue(listResult([]))
    const w = await mountAt(VideoListPage, '/page?search=zzz')
    expect(t(w, 'video-empty').text()).toContain('Tiada Video Dijumpai')
    expect(t(w, 'video-empty').text()).toContain('Cuba ubah carian atau pilih kategori lain.')
    expect(t(w, 'video-empty-action').attributes('href')).toBe('/video')
    expect(w.find('[data-testid="video-empty-all"]').exists()).toBe(false)
  })

  it('guest: hero without "Tambah Video"', async () => {
    const w = await mountAt(VideoListPage, '/page')
    expect(t(w, 'video-guest-hero').text()).toContain('Tonton & Fahami')
    expect(t(w, 'video-guest-hero').text()).toContain('VIDEO PEMBELAJARAN')
    expect(w.find('[data-testid="video-add"]').exists()).toBe(false)
  })

  it('submitting the search pushes ?search and keeps the filters', async () => {
    login()
    const w = await mountAt(VideoListPage, '/page?category=tutorial')
    await t(w, 'video-search').setValue('sejarah')
    await t(w, 'video-search-form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/video?category=tutorial&search=sejarah')
  })
})

describe('VideoDetailPage (S18)', () => {
  it('renders the player placeholder with the embed URL, chips, uploader and related', async () => {
    login('admin')
    api.fetchVideo.mockResolvedValue(detail(2224))
    const w = await mountAt(VideoDetailPage, '/page', { id: 2224 })
    expect(t(w, 'video-player').attributes('data-embed-url')).toBe(
      'https://www.youtube.com/embed/abc123XYZ00',
    )
    expect(t(w, 'video-player-frame').attributes('src')).toBe(
      'https://www.youtube.com/embed/abc123XYZ00',
    )
    expect(t(w, 'video-title').text()).toBe('Video 2224')
    expect(t(w, 'video-views').text()).toBe('2234 tontonan')
    expect(t(w, 'video-date').text()).toBe('03 Mar 2026')
    expect(t(w, 'video-chip-platform').text()).toBe('YouTube')
    expect(t(w, 'video-chip-category').text()).toBe('Ceramah')
    expect(t(w, 'video-chip-subject').text()).toBe('Sejarah')
    expect(t(w, 'video-uploader-name').text()).toBe('Admin Demo')
    expect(t(w, 'video-edit').attributes('href')).toBe('/video/2224/edit')
    expect(w.findAll('[data-testid="video-related-card"]')).toHaveLength(1)
    expect(t(w, 'video-back').attributes('href')).toBe('/video')
  })

  it('hides Edit and Padam when the user cannot manage the video', async () => {
    login()
    api.fetchVideo.mockResolvedValue(detail(5, { canManage: false, related: [] }))
    const w = await mountAt(VideoDetailPage, '/page', { id: 5 })
    expect(w.find('[data-testid="video-edit"]').exists()).toBe(false)
    expect(w.find('[data-testid="video-delete"]').exists()).toBe(false)
    expect(w.find('[data-testid="video-related"]').exists()).toBe(false)
  })

  it('does not embed or link non-http addresses and renders no markup from the description', async () => {
    login()
    api.fetchVideo.mockResolvedValue(
      detail(6, {
        embedUrl: null,
        videoUrl: 'javascript:alert(1)',
        description: '<img src=x onerror=alert(1)>',
      }),
    )
    const w = await mountAt(VideoDetailPage, '/page', { id: 6 })
    expect(t(w, 'video-player').attributes('data-embed-url')).toBeUndefined()
    expect(w.find('[data-testid="video-player-link"]').exists()).toBe(false)
    expect(w.find('[data-testid="video-description"] img').exists()).toBe(false)
  })

  it('only embeds an https URL of an allowed provider', async () => {
    login()
    api.fetchVideo.mockResolvedValue(detail(8, { embedUrl: 'https://evil.example/embed/x' }))
    const w = await mountAt(VideoDetailPage, '/page', { id: 8 })
    expect(w.find('iframe').exists()).toBe(false)
    expect(t(w, 'video-player').attributes('data-embed-url')).toBeUndefined()
    expect(t(w, 'video-player-link').attributes('href')).toBe(
      'https://www.youtube.com/watch?v=abc123XYZ00',
    )
  })

  it('a thumbnail that fails to load leaves an empty frame (no drawn placeholder)', async () => {
    login()
    api.fetchVideos.mockResolvedValue(listResult([card(1), card(2, { thumbnailUrl: null })]))
    const w = await mountAt(VideoListPage, '/page')
    const cards = w.findAll('[data-testid="video-card"]')
    expect(cards[0]?.find('img').attributes('src')).toBe(
      'https://img.youtube.com/vi/ID1/hqdefault.jpg',
    )
    expect(cards[1]?.find('img').exists()).toBe(false)
  })

  it('delete: dismiss keeps the video; accept deletes, flashes and returns to /video', async () => {
    login('admin')
    api.fetchVideo.mockResolvedValue(detail(7))
    api.deleteVideo.mockResolvedValue({ data: { deleted: 1 }, status: 'Video berjaya dipadam.' })
    const w = await mountAt(VideoDetailPage, '/page', { id: 7 })

    dialogs.confirmNative.mockReturnValueOnce(false)
    await t(w, 'video-delete').trigger('click')
    expect(dialogs.confirmNative).toHaveBeenCalledWith('Padam video ini?')
    expect(api.deleteVideo).not.toHaveBeenCalled()

    await t(w, 'video-delete').trigger('click')
    await flushPromises()
    expect(api.deleteVideo).toHaveBeenCalledWith(7)
    expect(router.currentRoute.value.path).toBe('/video')
    expect(useFlashStore().pending?.message).toBe('Video berjaya dipadam.')
  })

  it('an unknown id raises the 404 outcome', async () => {
    login()
    api.fetchVideo.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await mountAt(VideoDetailPage, '/page', { id: 99999 })
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })
})

describe('VideoFormPage (S20 add)', () => {
  it('renders the add form with the R1-GUR-7 copy and no visibility field', async () => {
    login('admin')
    const w = await mountAt(VideoFormPage, '/page', { mode: 'create' })
    expect(t(w, 'video-form-h1').text()).toBe('Tambah Video Baru')
    const labels = w.findAll('label').map((l) => l.text().replace(/\s+/g, ' '))
    // The required star is drawn by the field (CSS), so the text is the bare label.
    expect(labels).toEqual(['Pautan YouTube', 'Tajuk Video', 'Penerangan', 'Kategori', 'Subjek (pilihan)'])
    expect(t(w, 'video-title-input').attributes('required')).toBeDefined()
    expect(t(w, 'video-url').attributes('required')).toBeDefined()
    expect(t(w, 'video-url').attributes('type')).toBe('url')
    expect(t(w, 'video-title-input').attributes('maxlength')).toBe('150')
    expect(category(w).props('modelValue')).toBe('lain-lain')
    expect(t(w, 'video-description-input').attributes('maxlength')).toBe('1000')
    const options = (subject(w).props('items') as { label: string }[]).map((o) => o.label)
    expect(options).toEqual(['— Tiada subjek —', 'Matematik', 'Sejarah'])
    expect(w.text()).not.toContain('Siapa boleh lihat?')
    expect(w.find('[data-testid="video-visibility"]').exists()).toBe(false)
    expect(t(w, 'video-uploader-strip').text()).toContain('Admin Demo')
    expect(t(w, 'form-submit').text()).toBe('Tambah Video')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/video')
  })

  it('validates with the contract copy and posts nothing when invalid', async () => {
    login('teacher')
    const w = await mountAt(VideoFormPage, '/page', { mode: 'create' })
    await t(w, 'video-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Sila isi tajuk video.')
    expect(w.text()).toContain('Sila isi pautan YouTube.')
    await t(w, 'video-title-input').setValue('x'.repeat(151))
    await t(w, 'video-url').setValue('https://example.org/video')
    await t(w, 'video-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Tajuk video tidak boleh melebihi 150 aksara.')
    expect(w.text()).toContain('Pautan mesti pautan YouTube yang sah.')
    expect(api.createVideo).not.toHaveBeenCalled()
  })

  it('the admin keeps any http(s) link for now', async () => {
    login('admin')
    api.createVideo.mockResolvedValue({ data: detail(2261), status: 'x' })
    const w = await mountAt(VideoFormPage, '/page', { mode: 'create' })
    await t(w, 'video-url').setValue('https://vimeo.com/123')
    await t(w, 'video-title-input').setValue('Tajuk')
    await t(w, 'video-form').trigger('submit')
    await flushPromises()
    expect(api.createVideo).toHaveBeenCalledTimes(1)
  })

  it('detects the platform 500 ms after the last input and shows nothing for other URLs', async () => {
    login()
    const w = await mountAt(VideoFormPage, '/page', { mode: 'create' })
    vi.useFakeTimers()
    try {
      await t(w, 'video-url').setValue('https://youtu.be/abc123XYZ00')
      expect(w.find('[data-testid="video-preview"]').exists()).toBe(false)
      await vi.advanceTimersByTimeAsync(500)
      expect(t(w, 'video-preview-label').text()).toBe('Platform dikesan: YouTube')
      expect(t(w, 'video-thumb').attributes('data-thumbnail-url')).toBe(
        'https://img.youtube.com/vi/abc123XYZ00/hqdefault.jpg',
      )
      await t(w, 'video-url').setValue('https://vimeo.com/123')
      await vi.advanceTimersByTimeAsync(500)
      expect(t(w, 'video-preview-label').text()).toBe('Platform dikesan: Vimeo')
      expect(w.find('[data-testid="video-thumb"]').exists()).toBe(false)
      await t(w, 'video-url').setValue('https://example.com/x')
      await vi.advanceTimersByTimeAsync(500)
      expect(w.find('[data-testid="video-preview"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('teacher adds a video: no visibility sent, toast "Video ditambah.", back to /video', async () => {
    login('teacher')
    api.createVideo.mockResolvedValue({ data: detail(2261), status: 'Mesej pelayan.' })
    const w = await mountAt(VideoFormPage, '/page', { mode: 'create' })
    await t(w, 'video-url').setValue('https://youtu.be/abc123XYZ00')
    await t(w, 'video-title-input').setValue('  Tajuk baru ')
    category(w).vm.$emit('update:modelValue', 'tutorial')
    subject(w).vm.$emit('update:modelValue', '3')
    await flushPromises()
    await t(w, 'video-form').trigger('submit')
    await flushPromises()
    expect(api.createVideo).toHaveBeenCalledWith({
      videoUrl: 'https://youtu.be/abc123XYZ00',
      title: 'Tajuk baru',
      description: null,
      category: 'tutorial',
      subjectId: 3,
    })
    expect(useFlashStore().pending?.message).toBe('Video ditambah.')
    expect(router.currentRoute.value.path).toBe('/video')
  })

  describe('subject id on the wire (SWX-03, DV-M09-26)', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    async function submitWith(subjectValue: string | null) {
      login('admin')
      api.createVideo.mockResolvedValue({
        data: detail(2261),
        status: 'Video berjaya diterbitkan.',
      })
      const w = await mountAt(VideoFormPage, '/page', { mode: 'create' })
      await t(w, 'video-url').setValue('https://youtu.be/abc123XYZ00')
      await t(w, 'video-title-input').setValue('Tajuk baru')
      category(w).vm.$emit('update:modelValue', 'tutorial')
      if (subjectValue !== null) subject(w).vm.$emit('update:modelValue', subjectValue)
      await flushPromises()
      await t(w, 'video-form').trigger('submit')
      await flushPromises()
      return api.createVideo.mock.calls[0]?.[0] as { subjectId?: unknown }
    }

    it('http mode sends the chosen subject as a string', async () => {
      vi.stubEnv('VITE_API_MODE', 'http')
      expect((await submitWith('3')).subjectId).toBe('3')
    })

    it('http mode keeps string ids from the API unchanged (no numeric round trip)', async () => {
      vi.stubEnv('VITE_API_MODE', 'http')
      media.fetchSubjectOptions.mockResolvedValue({
        data: [{ id: '12', name: 'Sains' }],
      })
      expect((await submitWith('12')).subjectId).toBe('12')
    })

    it('mock mode still sends the numeric id the mock expects', async () => {
      expect((await submitWith('3')).subjectId).toBe(3)
    })

    it('"Tiada subjek" sends null in both modes', async () => {
      expect((await submitWith('none')).subjectId).toBeNull()
      api.createVideo.mockReset()
      vi.stubEnv('VITE_API_MODE', 'http')
      expect((await submitWith('none')).subjectId).toBeNull()
    })
  })

  it('shows 422 field messages and stays on the form', async () => {
    login()
    api.createVideo.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { videoUrl: 'Medan tidak sah.' },
      }),
    )
    const w = await mountAt(VideoFormPage, '/page', { mode: 'create' })
    await t(w, 'video-url').setValue('https://example.com')
    await t(w, 'video-title-input').setValue('T')
    category(w).vm.$emit('update:modelValue', 'ceramah')
    await flushPromises()
    await t(w, 'video-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Medan tidak sah.')
    expect(router.currentRoute.value.path).toBe('/page')
  })
})

describe('VideoFormPage (S19 edit)', () => {
  it('preloads the fields, labels without "(opsional)", no placeholder option, no strip', async () => {
    login('admin')
    editApi.fetchVideoForEdit.mockResolvedValue(detail(2224))
    const w = await mountAt(VideoFormPage, '/page', { mode: 'edit', id: 2224 })
    expect(t(w, 'video-form-h1').text()).toBe('Edit Video')
    expect(t(w, 'video-form-sub').text()).toBe('Kemaskini maklumat video')
    expect((t(w, 'video-url').element as HTMLInputElement).value).toBe(
      'https://www.youtube.com/watch?v=abc123XYZ00',
    )
    expect(category(w).props('modelValue')).toBe('ceramah')
    expect(subject(w).props('modelValue')).toBe('5')
    expect(t(w, 'video-preview-label').text()).toBe('Platform dikesan: Youtube')
    expect(w.find('[data-testid="video-uploader-strip"]').exists()).toBe(false)
    expect(w.text()).not.toContain('(opsional)')
    expect(t(w, 'form-submit').text()).toBe('Simpan Perubahan')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/video/2224')
  })

  it('saves and returns to the detail page', async () => {
    login('admin')
    editApi.fetchVideoForEdit.mockResolvedValue(detail(2224))
    api.updateVideo.mockResolvedValue({ data: detail(2224), status: 'Video berjaya dikemaskini.' })
    const w = await mountAt(VideoFormPage, '/page', { mode: 'edit', id: 2224 })
    await t(w, 'video-title-input').setValue('Tajuk lain')
    await t(w, 'video-form').trigger('submit')
    await flushPromises()
    expect(api.updateVideo).toHaveBeenCalledWith(
      2224,
      expect.objectContaining({ title: 'Tajuk lain', subjectId: 5, category: 'ceramah' }),
    )
    expect(router.currentRoute.value.path).toBe('/video/2224')
  })

  it('http mode: editing a video that has a subject sends that subject as a string', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    try {
      login('admin')
      editApi.fetchVideoForEdit.mockResolvedValue(
        detail(2224, { subject: { id: 5, name: 'Sejarah' } }),
      )
      api.updateVideo.mockResolvedValue({
        data: detail(2224),
        status: 'Video berjaya dikemaskini.',
      })
      const w = await mountAt(VideoFormPage, '/page', { mode: 'edit', id: 2224 })
      expect(subject(w).props('modelValue')).toBe('5')
      await t(w, 'video-form').trigger('submit')
      await flushPromises()
      expect(api.updateVideo.mock.calls[0]?.[1]).toMatchObject({ subjectId: '5' })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('sends a user who cannot manage the video to their landing page', async () => {
    login()
    editApi.fetchVideoForEdit.mockResolvedValue(detail(2224, { canManage: false }))
    const w = await mountAt(VideoFormPage, '/page', { mode: 'edit', id: 2224 })
    expect(router.currentRoute.value.path).toBe('/dashboard')
    expect(w.find('[data-testid="video-form"]').exists()).toBe(false)
  })

  it('an unknown id raises the 404 outcome', async () => {
    login()
    editApi.fetchVideoForEdit.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await mountAt(VideoFormPage, '/page', { mode: 'edit', id: 99999 })
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })
  it('loads through the non-counting ?for=edit read, never the counting detail read', async () => {
    login('admin')
    editApi.fetchVideoForEdit.mockResolvedValue(detail(2224))
    await mountAt(VideoFormPage, '/page', { mode: 'edit', id: 2224 })
    expect(editApi.fetchVideoForEdit).toHaveBeenCalledTimes(1)
    expect(editApi.fetchVideoForEdit.mock.calls[0]?.[0]).toBe(2224)
    expect(api.fetchVideo).not.toHaveBeenCalled()
  })
})
