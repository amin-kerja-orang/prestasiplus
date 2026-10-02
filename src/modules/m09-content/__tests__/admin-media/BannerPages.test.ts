// @vitest-environment jsdom
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import BannerFormPage from '../../pages/BannerFormPage.vue'
import BannerListPage from '../../pages/BannerListPage.vue'
import { banner, makeRouter, mountAt, t } from './harness'

const api = vi.hoisted(() => ({
  fetchAdminBanners: vi.fn(),
  fetchAdminBanner: vi.fn(),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
}))
vi.mock('../../api/admin-media', () => api)

const dialogs = vi.hoisted(() => ({ confirmNative: vi.fn(() => true), alertNative: vi.fn() }))
vi.mock('@/components/overlay/native-dialogs', () => dialogs)

const FIVE = [
  banner(1, {
    title: 'Selamat Datang ke PRESTASIPLUS',
    description:
      'Platform pembelajaran interaktif untuk pelajar sekolah. Jom mula belajar hari ini!',
  }),
  banner(2, { bannerType: 'FEATURE', targetAudience: 'STUDENT' }),
  banner(3, { bannerType: 'PROMOTIONAL', targetAudience: 'STUDENT' }),
  banner(4, { bannerType: 'ANNOUNCEMENT' }),
  banner(5, { bannerType: 'FEATURE', targetAudience: 'STUDENT', isActive: false }),
]

let wrapper: VueWrapper | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  dialogs.confirmNative.mockReset().mockReturnValue(true)
  api.fetchAdminBanners.mockResolvedValue(FIVE)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('BannerListPage (S9)', () => {
  it('shows the heading, the count, "Tambah" and the columns', async () => {
    wrapper = (await mountAt(BannerListPage, '/page')).wrapper
    const w = wrapper
    expect(w.text()).toContain('Senarai Banner')
    expect(t(w, 'banners-count').text()).toBe('Jumlah: 5 banner')
    expect(t(w, 'banners-add').attributes('href')).toBe('/admin/banners/create')
    expect(t(w, 'banners-add').text()).toBe('Tambah')
    expect(w.findAll('[data-testid=banners-th]').map((th) => th.text())).toEqual([
      '#',
      'Tajuk',
      'Jenis',
      'Sasaran',
      'Susunan',
      'Mula',
      'Tamat',
      'Aktif?',
      'Tindakan',
    ])
  })

  it('renders each row in API order with the raw codes, dates and the cut description', async () => {
    wrapper = (await mountAt(BannerListPage, '/page')).wrapper
    const rows = wrapper.findAll('[data-testid=banner-row]')
    expect(rows).toHaveLength(5)
    const first = rows[0]!
    expect(first.get('[data-testid=banner-title]').text()).toBe('Selamat Datang ke PRESTASIPLUS')
    expect(first.get('[data-testid=banner-description]').text()).toBe(
      'Platform pembelajaran interaktif untuk pelajar sek...',
    )
    expect(first.get('[data-testid=banner-type]').text()).toBe('HERO')
    expect(first.get('[data-testid=banner-audience]').text()).toBe('ALL')
    expect(first.get('[data-testid=banner-order]').classes()).toContain('rounded-md')
    expect(first.get('[data-testid=banner-start]').text()).toBe('01/01/2026')
    expect(first.get('[data-testid=banner-end]').text()).toBe('31/12/2026')
    expect(first.get('[data-testid=banner-active]').text()).toBe('Aktif')
    expect(rows.map((r) => r.get('[data-testid=banner-type]').text())).toEqual([
      'HERO',
      'FEATURE',
      'PROMOTIONAL',
      'ANNOUNCEMENT',
      'FEATURE',
    ])
    // The row number is the position, not the id.
    expect(first.findAll('td')[0]?.text()).toBe('1')
  })

  it('has an edit link and a delete button per row and no view action', async () => {
    wrapper = (await mountAt(BannerListPage, '/page')).wrapper
    const edits = wrapper.findAll('[data-testid=banner-edit]')
    expect(edits[1]?.attributes('href')).toBe('/admin/banners/2/edit')
    expect(edits[1]?.attributes('title')).toBe('Edit')
    expect(wrapper.findAll('[data-testid=banner-delete]')[0]?.attributes('title')).toBe('Padam')
    expect(wrapper.find('[title=Lihat]').exists()).toBe(false)
  })

  it('marks an inactive banner with the placeholder pill', async () => {
    wrapper = (await mountAt(BannerListPage, '/page')).wrapper
    expect(wrapper.findAll('[data-testid=banner-active]')[4]?.text()).toBe('Tidak Aktif')
  })

  it('keeps the table inside its scrolling card', async () => {
    wrapper = (await mountAt(BannerListPage, '/page')).wrapper
    expect(wrapper.find('.overflow-x-auto').exists()).toBe(true)
  })

  it('delete: dismissing the confirm sends nothing', async () => {
    dialogs.confirmNative.mockReturnValue(false)
    wrapper = (await mountAt(BannerListPage, '/page')).wrapper
    await wrapper.findAll('[data-testid=banner-delete]')[0]!.trigger('click')
    expect(dialogs.confirmNative).toHaveBeenCalledWith('Adakah anda pasti mahu padam banner ini?')
    expect(api.deleteBanner).not.toHaveBeenCalled()
  })

  it('delete: accepting deletes, reloads and shows the success flash', async () => {
    api.deleteBanner.mockResolvedValue({
      data: { deleted: 1 },
      status: 'Banner berjaya dipadam.',
    })
    wrapper = (await mountAt(BannerListPage, '/page')).wrapper
    api.fetchAdminBanners.mockResolvedValue(FIVE.slice(1))
    await wrapper.findAll('[data-testid=banner-delete]')[0]!.trigger('click')
    await flushPromises()
    expect(api.deleteBanner).toHaveBeenCalledWith(1)
    expect(t(wrapper, 'banners-count').text()).toBe('Jumlah: 4 banner')
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Banner berjaya dipadam.',
    })
  })

  it('shows the load error when the list cannot be fetched', async () => {
    api.fetchAdminBanners.mockRejectedValue(new Error('x'))
    wrapper = (await mountAt(BannerListPage, '/page')).wrapper
    expect(t(wrapper, 'banners-error').text()).toContain('Ralat memuatkan data')
  })
})

async function form(mode: 'create' | 'edit', id = 1) {
  const router = makeRouter([{ path: '/form', component: BannerFormPage }])
  const mounted = await mountAt(BannerFormPage, '/form', { mode, id }, router)
  wrapper = mounted.wrapper
  return mounted
}

const shown = (el: Element): boolean => (el as HTMLElement).style.display !== 'none'
const val = (w: VueWrapper, id: string) => (t(w, id).element as HTMLInputElement).value

describe('BannerFormPage create (S10)', () => {
  it('shows the labels, placeholders, hints and defaults', async () => {
    const { wrapper: w } = await form('create')
    expect(t(w, 'banner-back').text()).toBe('Kembali ke Senarai')
    expect(t(w, 'banner-back').attributes('href')).toBe('/admin/banners')
    expect(t(w, 'banner-title').attributes('placeholder')).toBe('cth: Promosi SPM 2024')
    expect(t(w, 'banner-title').attributes('required')).toBeDefined()
    expect(t(w, 'banner-description').attributes('placeholder')).toBe(
      'Penerangan ringkas tentang banner',
    )
    expect(t(w, 'banner-image-url').attributes('type')).toBe('url')
    expect(t(w, 'banner-image-url').attributes('placeholder')).toBe('https://example.com/image.jpg')
    expect(w.text()).toContain('Masukkan URL gambar banner')
    expect(w.text()).toContain('Nombor lebih kecil akan dipaparkan dahulu')
    expect(w.text()).toContain('Tandakan untuk memaparkan banner')
    expect(val(w, 'banner-order')).toBe('0')
    expect(t(w, 'banner-order').attributes('min')).toBe('0')
    expect((t(w, 'banner-active').element as HTMLInputElement).checked).toBe(true)
    expect(val(w, 'banner-type')).toBe('')
    expect(t(w, 'banner-type').attributes('required')).toBeDefined()
    expect(
      t(w, 'banner-type')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Pilih jenis banner', 'Hero', 'Promo', 'Pengumuman', 'Acara'])
    expect(
      t(w, 'banner-link-type')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Tiada Pautan', 'Subjek', 'Kuiz', 'Artikel', 'Pautan Luar'])
    expect(val(w, 'banner-audience')).toBe('all')
    expect(
      t(w, 'banner-audience')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Semua', 'Pelajar', 'Guru', 'Admin'])
    expect(t(w, 'form-submit').text()).toBe('Simpan Banner')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/admin/banners')
  })

  it('shows the URL input only for "Pautan Luar" and keeps its value when hidden', async () => {
    const { wrapper: w } = await form('create')
    const external = t(w, 'banner-external-url')
    expect(shown(external.element)).toBe(false)
    await t(w, 'banner-link-type').setValue('subject')
    expect(shown(external.element)).toBe(false)
    await t(w, 'banner-link-type').setValue('external')
    expect(shown(external.element)).toBe(true)
    expect(external.attributes('placeholder')).toBe('https://example.com')
    await external.setValue('https://typed.example')
    await t(w, 'banner-link-type').setValue('none')
    expect(shown(external.element)).toBe(false)
    await t(w, 'banner-link-type').setValue('external')
    expect(val(w, 'banner-external-url')).toBe('https://typed.example')
  })

  it('posts the upper-case codes without externalUrl, queues the flash and returns to S9', async () => {
    api.createBanner.mockResolvedValue({ data: banner(6), status: 'Banner berjaya ditambah.' })
    const { wrapper: w, router } = await form('create')
    await t(w, 'banner-title').setValue('Promosi')
    await t(w, 'banner-type').setValue('announcement')
    await t(w, 'banner-order').setValue('6')
    await t(w, 'banner-external-url').setValue('https://ignored.example')
    await t(w, 'banner-form').trigger('submit')
    await flushPromises()
    expect(api.createBanner).toHaveBeenCalledTimes(1)
    const body = api.createBanner.mock.calls[0]![0] as Record<string, unknown>
    expect(body).toMatchObject({
      title: 'Promosi',
      bannerType: 'ANNOUNCEMENT',
      linkType: 'NONE',
      targetAudience: 'ALL',
      displayOrder: 6,
      isActive: true,
    })
    expect('externalUrl' in body).toBe(false)
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Banner berjaya ditambah.',
    })
    expect(router.currentRoute.value.path).toBe('/admin/banners')
  })

  it('keeps the input and shows a 422 under the field', async () => {
    api.createBanner.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { title: 'Medan ini diperlukan.' },
      }),
    )
    const { wrapper: w, router } = await form('create')
    await t(w, 'banner-title').setValue('Promosi')
    await t(w, 'banner-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Medan ini diperlukan.')
    expect(val(w, 'banner-title')).toBe('Promosi')
    expect(router.currentRoute.value.path).toBe('/form')
  })
})

describe('BannerFormPage edit (S11)', () => {
  it('preselects stored codes and offers an extra option for an unmatched type (DV-M09-07)', async () => {
    api.fetchAdminBanner.mockResolvedValue(
      banner(2, { bannerType: 'FEATURE', targetAudience: 'STUDENT', linkType: 'NONE' }),
    )
    const { wrapper: w } = await form('edit', 2)
    expect(api.fetchAdminBanner).toHaveBeenCalledWith(2, expect.anything())
    expect(val(w, 'banner-type')).toBe('FEATURE')
    expect(
      t(w, 'banner-type')
        .findAll('option')
        .map((o) => o.text())[0],
    ).toBe('FEATURE')
    expect(val(w, 'banner-audience')).toBe('student')
    expect(val(w, 'banner-link-type')).toBe('none')
    expect(val(w, 'banner-title')).toBe('Banner 2')
    expect(val(w, 'banner-start')).toBe('2026-01-01')
    expect(t(w, 'form-submit').text()).toBe('Kemaskini Banner')
    expect((t(w, 'banner-type').element as HTMLSelectElement).checkValidity()).toBe(true)
  })

  it('a matched code adds no extra option and the form is valid on load', async () => {
    api.fetchAdminBanner.mockResolvedValue(banner(1))
    const { wrapper: w } = await form('edit', 1)
    expect(val(w, 'banner-type')).toBe('hero')
    expect(
      t(w, 'banner-type')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Pilih jenis banner', 'Hero', 'Promo', 'Pengumuman', 'Acara'])
    expect((t(w, 'banner-form').element as HTMLFormElement).checkValidity()).toBe(true)
  })

  it('saving unchanged sends the stored codes and returns to S9 with the flash', async () => {
    api.fetchAdminBanner.mockResolvedValue(
      banner(2, { bannerType: 'FEATURE', targetAudience: 'STUDENT' }),
    )
    api.updateBanner.mockResolvedValue({
      data: banner(2),
      status: 'Banner berjaya dikemaskini.',
    })
    const { wrapper: w, router } = await form('edit', 2)
    await t(w, 'banner-form').trigger('submit')
    await flushPromises()
    expect(api.updateBanner).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        bannerType: 'FEATURE',
        targetAudience: 'STUDENT',
        linkType: 'NONE',
      }),
    )
    expect(useFlashStore().pending?.type).toBe('success')
    expect(router.currentRoute.value.path).toBe('/admin/banners')
  })

  it('an unknown id returns to S9 with the one-time error flash', async () => {
    api.fetchAdminBanner.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Banner 99 tidak dijumpai.' }),
    )
    const { router } = await form('edit', 99)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/banners')
    expect(useFlashStore().pending).toEqual({ type: 'error', message: 'Banner tidak dijumpai.' })
  })
})
