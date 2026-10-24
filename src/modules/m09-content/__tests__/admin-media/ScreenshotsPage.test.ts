// @vitest-environment jsdom
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import ScreenshotsPage from '../../pages/ScreenshotsPage.vue'
import { mountAt, t } from './harness'

const api = vi.hoisted(() => ({ fetchScreenshots: vi.fn(), uploadScreenshots: vi.fn() }))
vi.mock('../../api/admin-media', () => api)

let wrapper: VueWrapper | null = null

const shot = (id: number, fileName: string) => ({
  id,
  fileName,
  originalName: fileName,
  size: 10,
  mimeType: 'image/png',
  uploadedById: 1,
  createdAt: '2026-09-25T15:40:00+08:00',
})

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchScreenshots.mockReset().mockResolvedValue([])
  api.uploadScreenshots.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function pick(w: VueWrapper, files: File[]): Promise<void> {
  const field = w.get('input[type="file"]')
  Object.defineProperty(field.element, 'files', { value: files, configurable: true })
  return field.trigger('change')
}

describe('ScreenshotsPage (S14)', () => {
  it('renders both cards, the drop zone, the hidden input and the empty list', async () => {
    wrapper = (await mountAt(ScreenshotsPage, '/page')).wrapper
    const w = wrapper
    expect(w.text()).toContain('Upload Gambar')
    expect(w.text()).toContain('Format: JPG, PNG, GIF, WebP, BMP. Maks 10MB setiap fail.')
    expect(w.get('[data-ds=file-field]').text()).toContain('Klik atau seret fail ke sini')
    expect(w.get('[data-ds=file-field]').text()).toContain('Boleh pilih banyak fail')
    expect(w.text()).toContain(
      'Tip: guna nama fail yang ringkas. Sistem akan auto-sanitize nama fail.',
    )
    const input = w.get('input[type="file"]')
    expect(input.attributes('accept')).toBe('image/*')
    expect(input.attributes('multiple')).toBeDefined()
    expect(w.text()).toContain('Fail Sedia Ada')
    expect(t(w, 'files-count').text()).toBe('Jumlah: 0 fail')
    expect(t(w, 'files-empty').text()).toBe('Tiada fail lagi.')
  })

  it('choosing files uploads at once, lists them and shows the success flash', async () => {
    api.uploadScreenshots.mockResolvedValue({
      data: { saved: [shot(1, 'gambar-saya-1.png')], rejected: [] },
      status: '1 fail berjaya dimuat naik.',
    })
    wrapper = (await mountAt(ScreenshotsPage, '/page')).wrapper
    const file = new File(['x'], 'Gambar Saya (1).PNG', { type: 'image/png' })
    api.fetchScreenshots.mockResolvedValue([shot(1, 'gambar-saya-1.png')])
    await pick(wrapper, [file])
    await flushPromises()
    expect(api.uploadScreenshots).toHaveBeenCalledWith([file])
    expect(t(wrapper, 'files-count').text()).toBe('Jumlah: 1 fail')
    expect(wrapper.findAll('[data-testid=file-item]').map((li) => li.text())).toEqual([
      'gambar-saya-1.png',
    ])
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: '1 fail berjaya dimuat naik.',
    })
  })

  it('shows the image of a file with a real URL and a glyph for the mock placeholder or a broken image', async () => {
    api.fetchScreenshots.mockResolvedValue([
      { ...shot(3, 'baru.png'), url: 'blob:http://localhost/abc' },
      { ...shot(2, 'lama.png'), url: 'blob:mock/screenshots/lama.png' },
      { ...shot(1, 'rosak.png'), url: 'blob:http://localhost/gone' },
    ])
    wrapper = (await mountAt(ScreenshotsPage, '/page')).wrapper
    const w = wrapper
    const tiles = w.findAll('[data-testid=file-item]')
    expect(tiles.map((li) => li.find('[data-testid=file-image]').exists())).toEqual([
      true,
      false,
      true,
    ])
    expect(tiles[0]!.get('img').attributes('src')).toBe('blob:http://localhost/abc')
    // An image that fails to load falls back to the glyph.
    await tiles[2]!.get('img').trigger('error')
    expect(w.findAll('[data-testid=file-item]')[2]!.find('img').exists()).toBe(false)
  })

  it('refused files show an error flash with their reasons', async () => {
    api.uploadScreenshots.mockResolvedValue({
      data: {
        saved: [],
        rejected: [{ name: 'besar.png', reason: 'besar.png: format atau saiz tidak dibenarkan.' }],
      },
      status: '0 fail berjaya dimuat naik.',
    })
    wrapper = (await mountAt(ScreenshotsPage, '/page')).wrapper
    await pick(wrapper, [new File(['x'], 'besar.png', { type: 'image/png' })])
    await flushPromises()
    expect(useFlashStore().current).toEqual({
      type: 'error',
      message: ['besar.png: format atau saiz tidak dibenarkan.'],
    })
  })

  it('a 422 shows an error flash', async () => {
    api.uploadScreenshots.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB.',
      }),
    )
    wrapper = (await mountAt(ScreenshotsPage, '/page')).wrapper
    await pick(wrapper, [new File(['x'], 'a.svg', { type: 'image/svg+xml' })])
    await flushPromises()
    expect(useFlashStore().current?.type).toBe('error')
  })

  it('an empty choice sends nothing', async () => {
    wrapper = (await mountAt(ScreenshotsPage, '/page')).wrapper
    await pick(wrapper, [])
    expect(api.uploadScreenshots).not.toHaveBeenCalled()
  })
})
