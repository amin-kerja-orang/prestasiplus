// @vitest-environment jsdom
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import USelect from '@nuxt/ui/components/Select.vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useFlashStore } from '@/stores/flash'

import type { VideoCard, VideoDetail } from '../../api/types'
import routes from '../../routes/admin-media'
import AdminVideoListPage from '../../pages/AdminVideoListPage.vue'
import { chooseRowAction, menuItem, openRowMenu } from '../menu'
import { mountAt, t } from './harness'

const api = vi.hoisted(() => ({ fetchVideos: vi.fn(), deleteVideo: vi.fn() }))
vi.mock('../../api/content', () => api)
const edit = vi.hoisted(() => ({ fetchVideoForEdit: vi.fn() }))
vi.mock('../../lib/video-edit-api', () => edit)

const confirmCalls = vi.hoisted(() => [] as unknown[])
vi.mock('@/ds', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ds')>()),
  useConfirm: () => (options: unknown) => {
    confirmCalls.push(options)
    return Promise.resolve(true)
  },
}))

function card(id: number): VideoCard {
  return {
    id,
    title: `Video ${String(id)}`,
    platformLabel: 'YouTube',
    thumbnailUrl: null,
    views: 100 + id,
    createdAt: '2026-03-03T10:00:00+08:00',
    uploader: { name: 'Admin Demo', initial: 'A', roleLabel: 'admin' },
  }
}

function listResult(rows: VideoCard[], total = rows.length) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 25,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 25)),
      from: 1,
      to: rows.length,
      facets: {
        total,
        categories: [],
        subjects: [
          { id: 3, name: 'Matematik', count: 2 },
          { id: 5, name: 'Sejarah', count: 1 },
        ],
      },
    },
  }
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchVideos.mockReset().mockResolvedValue(listResult([card(1), card(2)]))
  api.deleteVideo.mockReset()
  confirmCalls.length = 0
  edit.fetchVideoForEdit.mockReset().mockImplementation((id: number) =>
    Promise.resolve({
      ...card(id),
      categoryLabel: 'Tutorial',
      subject: id === 1 ? { id: 3, name: 'Matematik' } : null,
    } as VideoDetail),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('route /admin/videos', () => {
  it('is an admin-only route of the admin shell', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const found = router.resolve('/admin/videos')
    expect(found.matched).toHaveLength(1)
    expect(found.meta).toMatchObject({ layout: 'admin', roles: ['admin'] })
  })
})

describe('AdminVideoListPage', () => {
  it('lists the columns, rows, "Tambah Video" and asks for 25 per page', async () => {
    wrapper = (await mountAt(AdminVideoListPage, '/page')).wrapper
    const w = wrapper
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      'Tajuk',
      'Kategori',
      'Subjek',
      'Tontonan',
      'Tarikh',
      'Tindakan',
    ])
    const cells = w.findAll('tbody tr')[0]!.findAll('td').map((td) => td.text())
    expect(cells.slice(0, 5)).toEqual(['Video 1', 'Tutorial', 'Matematik', '101', '03/03/2026'])
    expect(w.findAll('[data-testid=video-row]')).toHaveLength(2)
    expect(t(w, 'videos-add').attributes('href')).toBe('/video/tambah')
    expect(t(w, 'videos-add').text()).toBe('Tambah Video')
    expect(api.fetchVideos.mock.calls[0]?.[0]).toMatchObject({ page: 1, pageSize: 25 })
    expect(w.text()).not.toMatch(/Tingkatan|Bab|Status|Sembunyikan/)
  })

  it('filters by Subjek (default Semua) and goes back to page 1', async () => {
    wrapper = (await mountAt(AdminVideoListPage, '/page')).wrapper
    const w = wrapper
    const select = w.findComponent(USelect) as unknown as {
      props: (k: string) => unknown
      vm: { $emit: (e: string, v: unknown) => void }
    }
    const items = select.props('items') as { label: string; value: string }[]
    expect(items.map((i) => i.label)).toEqual(['Semua', 'Matematik', 'Sejarah'])
    expect(select.props('modelValue')).toBe('all')
    select.vm.$emit('update:modelValue', '5')
    await flushPromises()
    expect(api.fetchVideos.mock.calls.at(-1)?.[0]).toMatchObject({ subject: 5, page: 1, pageSize: 25 })
  })

  it('Edit links to /video/:id/edit', async () => {
    wrapper = (await mountAt(AdminVideoListPage, '/page')).wrapper
    const items = await openRowMenu(wrapper, 0)
    expect(wrapper.find('a[href="/video/1/edit"]').exists()).toBe(true)
    expect(menuItem(items, 'Padam')).toBeDefined()
  })

  it('Padam asks "Padam video ini?" with Batal / Ya, Padam, deletes, reloads and flashes', async () => {
    api.deleteVideo.mockResolvedValue({ data: { deleted: 1 }, status: 'Video berjaya dipadam.' })
    wrapper = (await mountAt(AdminVideoListPage, '/page')).wrapper
    await chooseRowAction(wrapper, 0, 'Padam')
    expect(confirmCalls[0]).toMatchObject({
      message: 'Padam video ini?',
      cancelLabel: 'Batal',
      confirmLabel: 'Ya, Padam',
    })
    expect(api.deleteVideo).toHaveBeenCalledWith(1)
    expect(api.fetchVideos).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current).toEqual({ type: 'success', message: 'Video berjaya dipadam.' })
  })

  it('shows "Tiada video dijumpai." when there are no videos', async () => {
    api.fetchVideos.mockResolvedValue(listResult([]))
    wrapper = (await mountAt(AdminVideoListPage, '/page')).wrapper
    expect(t(wrapper, 'videos-empty').text()).toContain('Tiada video dijumpai.')
  })

  it('pages 25 at a time', async () => {
    api.fetchVideos.mockResolvedValue(listResult(Array.from({ length: 25 }, (_, i) => card(i + 1)), 60))
    wrapper = (await mountAt(AdminVideoListPage, '/page')).wrapper
    expect(t(wrapper, 'videos-count').text()).toBe('Jumlah: 60 video')
    expect(wrapper.text()).toMatch(/Seterusnya|2/)
  })
})

