// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useFlashStore } from '@/stores/flash'

import type { ComposeContext, OwnPerutusanItem, PerutusanCard, PerutusanDetail } from '../../api'
import PerutusanComposePage from '../../pages/PerutusanComposePage.vue'
import PerutusanDetailPage from '../../pages/PerutusanDetailPage.vue'
import PerutusanListPage from '../../pages/PerutusanListPage.vue'
import PerutusanMinePage from '../../pages/PerutusanMinePage.vue'

const api = vi.hoisted(() => ({
  fetchPerutusan: vi.fn(),
  fetchMyPerutusan: vi.fn(),
  fetchPerutusanDetail: vi.fn(),
  fetchComposeContext: vi.fn(),
  createPerutusan: vi.fn(),
}))
vi.mock('../../api', () => api)

const NOW = '2026-09-01T10:00:00+08:00'

function card(id: number, extra: Partial<PerutusanCard> = {}): PerutusanCard {
  return {
    id,
    title: `Perutusan ${String(id)}`,
    excerpt: `Ringkasan ${String(id)}`,
    isPinned: false,
    hasVideo: false,
    scopeLabel: 'Seluruh Malaysia (Kebangsaan)',
    createdAt: NOW,
    author: { name: 'Nama Rekaan Satu', initials: 'NR', roleLabel: 'Pengetua' },
    topReaction: null,
    commentCount: 3,
    reads: 9,
    ...extra,
  }
}

function detail(extra: Partial<PerutusanDetail> = {}): PerutusanDetail {
  return {
    ...card(7),
    body: 'Baris satu\nBaris dua<script>alert(1)</script><b>tebal</b>',
    youtubeEmbedUrl: null,
    images: [],
    documents: [],
    isPublic: false,
    publicUrl: null,
    reactions: {} as PerutusanDetail['reactions'],
    myReactions: [],
    canWrite: false,
    ...extra,
  }
}

const paged = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, pageSize: rows.length, totalItems: rows.length, totalPages: 1, from: 1, to: rows.length },
})
const ctx = (extra: Partial<ComposeContext> = {}): ComposeContext => ({
  scope: 'school',
  scopeLabel: 'SK Contoh',
  canWrite: true,
  ...extra,
})

let wrapper: VueWrapper | null = null
let router: Router

async function mountAt(url: string, component: object, props: object = {}): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/perutusan', component: PerutusanListPage },
      { path: '/perutusan/tulis', component: PerutusanComposePage },
      { path: '/perutusan/saya', component: { template: '<div id="mine" />' } },
      { path: '/perutusan/:id(\\d+)', component: PerutusanDetailPage, props: true },
    ],
  })
  await router.push(url)
  wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchComposeContext.mockResolvedValue(ctx({ canWrite: false, scope: null }))
  setRouteOutcome(null)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('PerutusanListPage', () => {
  it('renders one card per post with chip, pin, byline without the author name and a detail link', async () => {
    api.fetchPerutusan.mockResolvedValue(paged([card(1, { isPinned: true }), card(2)]))
    const w = await mountAt('/perutusan', PerutusanListPage)
    const cards = w.findAll('[data-testid=perutusan-card]')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.text()).toContain('Perutusan 1')
    expect(cards[0]?.text()).toContain('Ringkasan 1')
    expect(cards[0]?.get('[data-testid=perutusan-scope]').text()).toBe('Seluruh Malaysia (Kebangsaan)')
    expect(cards[0]?.get('[data-testid=perutusan-pinned]').text()).toBe('📌 Disemat')
    expect(cards[1]?.find('[data-testid=perutusan-pinned]').exists()).toBe(false)
    const byline = cards[0]?.get('[data-testid=perutusan-byline]').text() ?? ''
    expect(byline).toMatch(/^Pengetua · /)
    expect(byline).not.toContain('Nama Rekaan')
    expect(cards[0]?.text()).not.toContain('Nama Rekaan')
    expect(cards[0]?.get('a').attributes('href')).toBe('/perutusan/1')
    expect(w.find('[data-testid=artikel-pager]').exists()).toBe(false)
  })

  it('shows "Tulis Perutusan" and "Perutusan Saya" only when the context allows writing', async () => {
    api.fetchPerutusan.mockResolvedValue(paged([card(1)]))
    let w = await mountAt('/perutusan', PerutusanListPage)
    expect(w.find('[data-testid=perutusan-write]').exists()).toBe(false)
    expect(w.find('[data-testid=perutusan-mine-link]').exists()).toBe(false)
    w.unmount()
    api.fetchComposeContext.mockResolvedValue(ctx())
    w = await mountAt('/perutusan', PerutusanListPage)
    expect(w.get('[data-testid=perutusan-write]').text()).toBe('Tulis Perutusan')
    expect(w.get('[data-testid=perutusan-write]').attributes('href')).toBe('/perutusan/tulis')
    expect(w.get('[data-testid=perutusan-mine-link]').text()).toBe('Perutusan Saya')
  })

  it('empty state "Tiada perutusan."', async () => {
    api.fetchPerutusan.mockResolvedValue(paged([]))
    const w = await mountAt('/perutusan', PerutusanListPage)
    expect(w.get('[data-testid=perutusan-empty]').text()).toContain('Tiada perutusan.')
  })

  it('load error shows the retry block and retries', async () => {
    api.fetchPerutusan.mockRejectedValueOnce(new ApiError({ status: 500, code: 'X', message: 'x' }))
    api.fetchPerutusan.mockResolvedValue(paged([card(1)]))
    const w = await mountAt('/perutusan', PerutusanListPage)
    expect(w.find('[data-testid=perutusan-card]').exists()).toBe(false)
    const retry = w.findAll('button').find((b) => b.text().includes('Cuba'))
    expect(retry).toBeDefined()
    await retry?.trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid=perutusan-card]')).toHaveLength(1)
  })
})

describe('PerutusanDetailPage', () => {
  it('shows the sanitised body, byline, date, back link and no reactions or comments', async () => {
    api.fetchPerutusanDetail.mockResolvedValue(detail({ images: [{ fileName: 'a.png', size: 1 }] }))
    const w = await mountAt('/perutusan/7', PerutusanDetailPage, { id: 7 })
    expect(api.fetchPerutusanDetail).toHaveBeenCalledWith(7, expect.anything())
    const body = w.get('[data-testid=perutusan-body]')
    expect(body.classes()).toContain('whitespace-pre-line')
    expect(body.html()).not.toContain('<script')
    expect(body.html()).toContain('<b>tebal</b>')
    expect(w.get('[data-testid=perutusan-title]').text()).toBe('Perutusan 7')
    expect(w.get('[data-testid=perutusan-byline]').text()).toMatch(/^Pengetua · /)
    expect(w.get('[data-testid=perutusan-date]').text()).toBe('1 September 2026')
    expect(w.text()).not.toContain('Nama Rekaan')
    expect(w.get('[data-testid=perutusan-back]').text()).toBe('← Perutusan')
    expect(w.get('[data-testid=perutusan-back]').attributes('href')).toBe('/perutusan')
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('iframe').exists()).toBe(false)
    expect(w.text().toLowerCase()).not.toMatch(/komen|reaksi/)
  })

  it('an unknown id raises the V3 404', async () => {
    api.fetchPerutusanDetail.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await mountAt('/perutusan/99', PerutusanDetailPage, { id: 99 })
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('PerutusanComposePage', () => {
  beforeEach(() => {
    api.fetchComposeContext.mockResolvedValue(ctx())
  })

  const fill = async (w: VueWrapper, title: string, body: string) => {
    await w.get('[data-testid=perutusan-title-input]').setValue(title)
    await w.get('[data-testid=perutusan-body-input]').setValue(body)
  }
  const submit = async (w: VueWrapper) => {
    await w.get('[data-testid=perutusan-compose-form]').trigger('submit')
    await flushPromises()
  }
  const errors = (w: VueWrapper) => w.findAll('[data-testid=field-error]').map((e) => e.text())

  it('validates empty and over-limit fields, sending nothing', async () => {
    const w = await mountAt('/perutusan/tulis', PerutusanComposePage)
    expect(w.get('[data-testid=perutusan-title-input]').attributes('maxlength')).toBeUndefined()
    await submit(w)
    expect(errors(w)).toEqual(['Sila isi tajuk perutusan.', 'Sila isi kandungan perutusan.'])
    await fill(w, 'a'.repeat(151), 'b'.repeat(2001))
    await submit(w)
    expect(errors(w)).toEqual([
      'Tajuk perutusan tidak boleh melebihi 150 aksara.',
      'Kandungan perutusan tidak boleh melebihi 2000 aksara.',
    ])
    expect(api.createPerutusan).not.toHaveBeenCalled()
  })

  it('posts {title, body, status: published}, flashes "Perutusan dihantar." and goes to /perutusan/saya', async () => {
    api.createPerutusan.mockResolvedValue({ status: 'Perutusan berjaya dihantar.', data: detail() })
    const w = await mountAt('/perutusan/tulis', PerutusanComposePage)
    await fill(w, 'a'.repeat(150), 'b'.repeat(2000))
    await submit(w)
    expect(api.createPerutusan).toHaveBeenCalledWith({
      title: 'a'.repeat(150),
      body: 'b'.repeat(2000),
      status: 'published',
    })
    expect(router.currentRoute.value.path).toBe('/perutusan/saya')
    const flash = useFlashStore()
    expect(flash.consume()).toMatchObject({ type: 'success', message: 'Perutusan dihantar.' })
  })

  it('shows server 422 field errors under the fields', async () => {
    api.createPerutusan.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION', message: 'x', fields: { title: 'Medan tidak sah.' } }),
    )
    const w = await mountAt('/perutusan/tulis', PerutusanComposePage)
    await fill(w, 'Tajuk', 'Isi')
    await submit(w)
    expect(errors(w)).toEqual(['Medan tidak sah.'])
    expect(router.currentRoute.value.path).toBe('/perutusan/tulis')
  })

  it('Skop is "Sekolah" for the school scope and the context label for national', async () => {
    let w = await mountAt('/perutusan/tulis', PerutusanComposePage)
    const scope = () => w.get('[data-testid=perutusan-scope-input]')
    expect((scope().element as HTMLInputElement).value).toBe('Sekolah')
    expect(scope().attributes('readonly')).toBeDefined()
    w.unmount()
    api.fetchComposeContext.mockResolvedValue(
      ctx({ scope: 'national', scopeLabel: 'Seluruh Malaysia (Kebangsaan)' }),
    )
    w = await mountAt('/perutusan/tulis', PerutusanComposePage)
    expect((scope().element as HTMLInputElement).value).toBe('Seluruh Malaysia (Kebangsaan)')
  })

  it('canWrite false raises the 403 page', async () => {
    api.fetchComposeContext.mockResolvedValue(ctx({ canWrite: false, scope: null }))
    const w = await mountAt('/perutusan/tulis', PerutusanComposePage)
    expect(useRouteOutcome().value).toBe(403)
    expect(w.find('[data-testid=perutusan-compose-form]').exists()).toBe(false)
  })
})

describe('PerutusanMinePage', () => {
  const row = (id: number, extra: Partial<OwnPerutusanItem> = {}): OwnPerutusanItem => ({
    id,
    title: `Saya ${String(id)}`,
    status: 'published',
    statusLabel: 'Diterbitkan',
    createdAt: NOW,
    ...extra,
  })

  it('lists every row with status chip, long date and a detail link', async () => {
    api.fetchMyPerutusan.mockResolvedValue(paged([row(3), row(4, { statusLabel: 'Draf', status: 'draft' })]))
    const w = await mountAt('/perutusan/saya', PerutusanMinePage)
    const rows = w.findAll('[data-testid=perutusan-mine-row]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.get('[data-testid=perutusan-mine-status]').text()).toBe('Diterbitkan')
    expect(rows[1]?.get('[data-testid=perutusan-mine-status]').text()).toBe('Draf')
    expect(rows[0]?.get('[data-testid=perutusan-mine-date]').text()).toBe('1 September 2026')
    expect(rows[0]?.get('a').attributes('href')).toBe('/perutusan/3')
  })

  it('empty state', async () => {
    api.fetchMyPerutusan.mockResolvedValue(paged([]))
    const w = await mountAt('/perutusan/saya', PerutusanMinePage)
    expect(w.get('[data-testid=perutusan-mine-empty]').text()).toContain(
      'Anda belum menghantar sebarang perutusan.',
    )
  })
})
