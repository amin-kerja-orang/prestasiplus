// @vitest-environment jsdom
/**
 * S7-T08 admin screens (R1-ADM-P2-12, R1-ADM-P2-13): AdminProdukPage, ProdukFormPage, AdminPenjualPage and
 * PenjualDetailPage against a mocked client: stat cards, filters, count lines, empty states, the actions each
 * status allows, the confirms, a refused (409) transition, the PRD field messages and the 5-image limit.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { confirmHost, confirmState, settleConfirm } from '@/ds/useConfirm'
import { useFlashStore } from '@/stores/flash'

import adminRoutes from '../../routes/admin'
import PenjualDetailPage from '../../pages/PenjualDetailPage.vue'
import AdminPenjualPage from '../../pages/AdminPenjualPage.vue'
import ProdukFormPage from '../../pages/ProdukFormPage.vue'
import AdminProdukPage from '../../pages/AdminProdukPage.vue'
import { CATEGORIES } from '../fixtures'

const api = vi.hoisted(() => ({
  fetchMarketplaceCategories: vi.fn(),
  fetchAdminProducts: vi.fn(),
  fetchAdminProduct: vi.fn(),
  createAdminProduct: vi.fn(),
  updateAdminProduct: vi.fn(),
  deleteAdminProduct: vi.fn(),
  deleteAdminProductImage: vi.fn(),
  fetchAdminSellerOptions: vi.fn(),
  fetchAdminSellers: vi.fn(),
  fetchAdminSeller: vi.fn(),
  runAdminSellerAction: vi.fn(),
  uploadMarketplaceImage: vi.fn(),
}))
vi.mock('../../api', () => api)

type Row = Record<string, unknown>

function product(id: number, extra: Row = {}): Row {
  return {
    id: String(id),
    slug: `produk-${String(id)}`,
    name: `Produk ${String(id)}`,
    price: '35.00',
    originalPrice: null,
    thumbnailUrl: null,
    sellerId: '1',
    sellerName: 'JomBelajar Official',
    categoryId: '1',
    categoryName: 'Peralatan Sekolah',
    condition: 'new',
    stockStatus: 'available',
    status: 'active',
    views: 3,
    createdAt: '2026-02-09T12:00:00+08:00',
    ...extra,
  }
}

const productList = (rows: Row[], stats = { total: 10, active: 10 }, totalItems = rows.length) => ({
  data: rows,
  meta: { page: 1, pageSize: 20, totalItems, totalPages: 1, stats },
})

function seller(id: number, status: string, actions: string[], extra: Row = {}): Row {
  return {
    id: String(id),
    shopName: `Kedai ${String(id)}`,
    initial: 'K',
    ownerMasked: 'A*** B***',
    status,
    verified: false,
    productCount: 2,
    actions,
    createdAt: '2026-02-09T12:00:00+08:00',
    ...extra,
  }
}

const sellerList = (rows: Row[], stats = { total: 4, active: 1, pending: 1 }) => ({
  data: rows,
  meta: { page: 1, pageSize: 20, totalItems: rows.length, totalPages: 1, stats },
})

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(component: Component, path: string, url: string, props: Row = {}) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...adminRoutes
        .filter((r) => r.path !== path)
        .map((r) => ({ path: r.path, name: r.name as string, component: { template: '<div />' } })),
      { path, component, props: true },
    ],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(component, {
    props: { ...router.currentRoute.value.params, ...props } as Record<string, string>,
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const t = (id: string) => `[data-testid="${id}"]`
const flashText = () => useFlashStore().current?.message
/** A flash queued for the next page (set before a navigation; the router consumes it). */
const queuedFlash = () => useFlashStore().pending?.message

/** Simulates the shell's `DsConfirmHost`: the dialog state is read and settled by the test. */
async function answerConfirm(yes: boolean) {
  expect(confirmState.open).toBe(true)
  const seen = { message: confirmState.message, confirmLabel: confirmState.confirmLabel, cancelLabel: confirmState.cancelLabel }
  settleConfirm(yes)
  await flushPromises()
  return seen
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  confirmHost.count = 1
  api.fetchMarketplaceCategories.mockResolvedValue(CATEGORIES)
  api.fetchAdminProducts.mockResolvedValue(productList([product(1), product(2, { status: 'draft' })]))
  api.fetchAdminSellers.mockResolvedValue(
    sellerList([
      seller(1, 'active', ['suspend', 'ban'], { verified: true }),
      seller(2, 'pending', ['approve', 'ban']),
      seller(3, 'suspended', ['approve', 'ban']),
      seller(4, 'banned', []),
    ]),
  )
  api.fetchAdminSellerOptions.mockResolvedValue([
    { id: null, label: 'PRESTASIPLUS Official (Admin)' },
    { id: '1', label: 'JomBelajar Official' },
  ])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  confirmHost.count = 0
  settleConfirm(false)
})

describe('admin routes', () => {
  it('are admin shell routes for the admin role only, with the PRD paths', () => {
    expect(adminRoutes.map((r) => r.path)).toEqual([
      '/admin/marketplace/products',
      '/admin/marketplace/products/create',
      '/admin/marketplace/products/:id/edit',
      '/admin/marketplace/sellers',
      '/admin/marketplace/sellers/:id',
    ])
    for (const r of adminRoutes) {
      expect(r.meta).toMatchObject({ layout: 'admin', access: 'auth', roles: ['admin'] })
    }
    expect(adminRoutes[0]!.meta?.header).toMatchObject({ title: 'Marketplace — Produk' })
    expect(adminRoutes[3]!.meta?.header).toMatchObject({ title: 'Marketplace — Penjual' })
  })
})

describe('AdminProdukPage (P2-12)', () => {
  it('shows the two global stat cards, the count line, the stock wording and the row actions', async () => {
    const w = await mountAt(AdminProdukPage, '/admin/marketplace/products', '/admin/marketplace/products')
    expect(w.get(t('stat-total')).text()).toContain('Jumlah Produk')
    expect(w.get(t('stat-total')).text()).toContain('10')
    expect(w.get(t('stat-active')).text()).toContain('Aktif')
    expect(w.get(t('admin-products-count')).text()).toBe('2 produk dijumpai')
    expect(w.get<HTMLInputElement>(t('admin-products-search')).attributes('placeholder')).toBe('Cari produk...')
    expect(w.text()).toContain('Semua Kategori')
    expect(w.text()).toContain('Semua Status')
    expect(w.text()).toContain('Tapis')
    expect(w.text()).toContain('Reset')
    // Decision 2 on #506: the OPT-MARKET wording, no "{n} stok".
    expect(w.text()).toContain('✅ Ada')
    expect(w.text()).not.toMatch(/\d+ stok/)
    const rows = w.findAll(t('admin-product-row'))
    expect(rows).toHaveLength(2)
    const toggles = w.findAll(t('admin-product-toggle')).map((b) => b.text())
    expect(toggles).toEqual(['Nyahaktif', 'Aktifkan'])
    expect(w.findAll(t('admin-product-edit'))).toHaveLength(2)
    expect(w.findAll(t('admin-product-delete'))).toHaveLength(2)
  })

  it('Tapis puts the filters in the URL and asks for them; Reset clears them', async () => {
    const w = await mountAt(AdminProdukPage, '/admin/marketplace/products', '/admin/marketplace/products')
    await w.get(t('admin-products-search')).setValue('beg')
    await w.get(t('admin-products-category')).setValue('2')
    await w.get(t('admin-products-status')).setValue('draft')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ q: 'beg', categoryId: '2', status: 'draft' })
    expect(api.fetchAdminProducts).toHaveBeenLastCalledWith(
      { q: 'beg', categoryId: '2', status: 'draft', page: '1' },
      expect.anything(),
    )
    const reset = w.findAll('button').find((b) => b.text() === 'Reset')!
    await reset.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('the category select offers the six categories and the status select Aktif, Draf, Ditolak', async () => {
    const w = await mountAt(AdminProdukPage, '/admin/marketplace/products', '/admin/marketplace/products')
    const cats = w.findAll(`${t('admin-products-category')} option`).map((o) => o.text())
    expect(cats).toEqual(['Semua Kategori', ...CATEGORIES.map((c) => c.name)])
    const statuses = w.findAll(`${t('admin-products-status')} option`).map((o) => o.text())
    expect(statuses).toEqual(['Semua Status', 'Aktif', 'Draf', 'Ditolak'])
  })

  it('empty without a filter: "📦 Tiada Produk" and "Tambah produk pertama sekarang!"', async () => {
    api.fetchAdminProducts.mockResolvedValue(productList([], { total: 0, active: 0 }))
    const w = await mountAt(AdminProdukPage, '/admin/marketplace/products', '/admin/marketplace/products')
    expect(w.get(t('admin-products-empty')).text()).toContain('📦 Tiada Produk')
    expect(w.get(t('admin-products-empty')).text()).toContain('Tambah produk pertama sekarang!')
    expect(w.get(t('admin-products-count')).text()).toBe('0 produk dijumpai')
    expect(w.get(t('admin-products-add')).text()).toContain('Tambah Produk')
  })

  it('Nyahaktif sends status draft; Aktifkan sends active; both reload', async () => {
    api.updateAdminProduct.mockResolvedValue({})
    const w = await mountAt(AdminProdukPage, '/admin/marketplace/products', '/admin/marketplace/products')
    const toggles = w.findAll(t('admin-product-toggle'))
    await toggles[0]!.trigger('click')
    await flushPromises()
    expect(api.updateAdminProduct).toHaveBeenLastCalledWith('1', { status: 'draft' })
    await w.findAll(t('admin-product-toggle'))[1]!.trigger('click')
    await flushPromises()
    expect(api.updateAdminProduct).toHaveBeenLastCalledWith('2', { status: 'active' })
    expect(api.fetchAdminProducts.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('delete asks "Padam produk ini?" with Batal / Ya, Padam; Batal keeps the product, Ya deletes and reloads', async () => {
    api.deleteAdminProduct.mockResolvedValue({ id: '1' })
    const w = await mountAt(AdminProdukPage, '/admin/marketplace/products', '/admin/marketplace/products')
    await w.findAll(t('admin-product-delete'))[0]!.trigger('click')
    const seen = await answerConfirm(false)
    expect(seen).toEqual({ message: 'Padam produk ini?', confirmLabel: 'Ya, Padam', cancelLabel: 'Batal' })
    expect(api.deleteAdminProduct).not.toHaveBeenCalled()
    await w.findAll(t('admin-product-delete'))[0]!.trigger('click')
    await answerConfirm(true)
    expect(api.deleteAdminProduct).toHaveBeenCalledWith('1')
    expect(flashText()).toBe('Produk berjaya dipadam.')
    // No order rule exists: the old "Produk ini mempunyai pesanan." text is gone.
    expect(w.text()).not.toContain('pesanan')
  })

  it('a failed delete shows the API message', async () => {
    api.deleteAdminProduct.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' }))
    const w = await mountAt(AdminProdukPage, '/admin/marketplace/products', '/admin/marketplace/products')
    await w.findAll(t('admin-product-delete'))[0]!.trigger('click')
    await answerConfirm(true)
    expect(flashText()).toBe('Rekod tidak dijumpai.')
  })

  it('a failed load shows the error box with a retry', async () => {
    api.fetchAdminProducts.mockRejectedValueOnce(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }))
    const w = await mountAt(AdminProdukPage, '/admin/marketplace/products', '/admin/marketplace/products')
    expect(w.get(t('admin-products-error')).text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
  })
})

describe('AdminPenjualPage (P2-13)', () => {
  it('shows the three global stat cards, the count line and a status badge per seller', async () => {
    const w = await mountAt(AdminPenjualPage, '/admin/marketplace/sellers', '/admin/marketplace/sellers')
    expect(w.get(t('stat-total')).text()).toContain('Jumlah Penjual')
    expect(w.get(t('stat-active')).text()).toContain('Aktif')
    expect(w.get(t('stat-pending')).text()).toContain('Menunggu Pengesahan')
    expect(w.get(t('admin-sellers-count')).text()).toBe('4 penjual dijumpai')
    expect(w.findAll(t('admin-seller-status')).map((s) => s.text())).toEqual(['Aktif', 'Pending', 'Digantung', 'Diharamkan'])
    expect(w.get(t('admin-seller-owner')).text()).toContain('A*** B***')
    expect(w.findAll(t('admin-seller-products'))[0]!.text()).toBe('2 produk')
  })

  it('offers only the actions each status allows', async () => {
    const w = await mountAt(AdminPenjualPage, '/admin/marketplace/sellers', '/admin/marketplace/sellers')
    const rows = w.findAll(t('seller-actions'))
    const labels = rows.map((r) => r.findAll('button, a').map((b) => b.text()))
    expect(labels).toEqual([
      ['Lihat Detail', 'Gantung', 'Haramkan'],
      ['Lihat Detail', 'Luluskan', 'Haramkan'],
      ['Lihat Detail', 'Luluskan', 'Haramkan'],
      ['Lihat Detail'],
    ])
  })

  it('the status filter lists Pending, Aktif, Digantung, Diharamkan and Tapis sends it', async () => {
    const w = await mountAt(AdminPenjualPage, '/admin/marketplace/sellers', '/admin/marketplace/sellers')
    expect(w.findAll(`${t('admin-sellers-status')} option`).map((o) => o.text())).toEqual([
      'Semua Status',
      'Pending',
      'Aktif',
      'Digantung',
      'Diharamkan',
    ])
    await w.get(t('admin-sellers-status')).setValue('pending')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'pending' })
    expect(api.fetchAdminSellers).toHaveBeenLastCalledWith({ status: 'pending', page: '1' }, expect.anything())
  })

  it('empty: "Tiada penjual dijumpai"', async () => {
    api.fetchAdminSellers.mockResolvedValue(sellerList([], { total: 0, active: 0, pending: 0 }))
    const w = await mountAt(AdminPenjualPage, '/admin/marketplace/sellers', '/admin/marketplace/sellers')
    expect(w.get(t('admin-sellers-empty')).text()).toContain('Tiada penjual dijumpai')
    expect(w.get(t('admin-sellers-count')).text()).toBe('0 penjual dijumpai')
  })

  it('Haramkan asks "Haramkan penjual ini?" and posts only after "Ya, Haramkan"', async () => {
    api.runAdminSellerAction.mockResolvedValue({})
    const w = await mountAt(AdminPenjualPage, '/admin/marketplace/sellers', '/admin/marketplace/sellers')
    await w.findAll(t('seller-action-ban'))[0]!.trigger('click')
    const seen = await answerConfirm(false)
    expect(seen).toEqual({ message: 'Haramkan penjual ini?', confirmLabel: 'Ya, Haramkan', cancelLabel: 'Batal' })
    expect(api.runAdminSellerAction).not.toHaveBeenCalled()
    await w.findAll(t('seller-action-ban'))[0]!.trigger('click')
    await answerConfirm(true)
    expect(api.runAdminSellerAction).toHaveBeenCalledWith('1', 'ban')
    expect(flashText()).toBe('Penjual berjaya diharamkan.')
  })

  it('Luluskan asks "Luluskan penjual ini?" with "Ya, Luluskan"', async () => {
    api.runAdminSellerAction.mockResolvedValue({})
    const w = await mountAt(AdminPenjualPage, '/admin/marketplace/sellers', '/admin/marketplace/sellers')
    await w.findAll(t('seller-action-approve'))[0]!.trigger('click')
    const seen = await answerConfirm(true)
    expect(seen).toMatchObject({ message: 'Luluskan penjual ini?', confirmLabel: 'Ya, Luluskan' })
    expect(api.runAdminSellerAction).toHaveBeenCalledWith('2', 'approve')
  })

  it('a refused transition (409) shows the API message and reloads the list', async () => {
    api.runAdminSellerAction.mockRejectedValue(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Perubahan status ini tidak dibenarkan daripada status semasa.' }),
    )
    const w = await mountAt(AdminPenjualPage, '/admin/marketplace/sellers', '/admin/marketplace/sellers')
    const before = api.fetchAdminSellers.mock.calls.length
    await w.findAll(t('seller-action-suspend'))[0]!.trigger('click')
    await answerConfirm(true)
    expect(flashText()).toBe('Perubahan status ini tidak dibenarkan daripada status semasa.')
    expect(api.fetchAdminSellers.mock.calls.length).toBeGreaterThan(before)
  })

  it('Lihat Detail links to the detail page', async () => {
    const w = await mountAt(AdminPenjualPage, '/admin/marketplace/sellers', '/admin/marketplace/sellers')
    expect(w.findAll(t('seller-action-detail'))[1]!.attributes('href')).toBe('/admin/marketplace/sellers/2')
  })
})

describe('PenjualDetailPage (Semak Penjual)', () => {
  const detail = (extra: Row = {}) => ({
    ...seller(2, 'pending', ['approve', 'ban']),
    description: 'Kedai ujian',
    phone: '0100000001',
    whatsapp: '60100000001',
    verifiedAt: null,
    whatsappClicks: 4,
    ...extra,
  })

  it('shows "Semak Penjual", "Maklumat Perniagaan", the masked owner, the status and the allowed actions', async () => {
    api.fetchAdminSeller.mockResolvedValue(detail())
    const w = await mountAt(PenjualDetailPage, '/admin/marketplace/sellers/:id', '/admin/marketplace/sellers/2')
    expect(api.fetchAdminSeller).toHaveBeenCalledWith('2', expect.anything())
    const text = w.get(t('admin-seller-detail')).text()
    expect(text).toContain('Semak Penjual')
    expect(text).toContain('Maklumat Perniagaan')
    expect(text).toContain('A*** B***')
    expect(text).toContain('Pending')
    expect(w.findAll(t('seller-actions') + ' button').map((b) => b.text())).toEqual(['Luluskan', 'Haramkan'])
  })

  it('an action replaces the shown seller with the answer (actions follow the new status)', async () => {
    api.fetchAdminSeller.mockResolvedValue(detail())
    api.runAdminSellerAction.mockResolvedValue(detail({ status: 'active', actions: ['verify', 'suspend', 'ban'] }))
    const w = await mountAt(PenjualDetailPage, '/admin/marketplace/sellers/:id', '/admin/marketplace/sellers/2')
    await w.get(t('seller-action-approve')).trigger('click')
    await answerConfirm(true)
    expect(w.findAll(t('seller-actions') + ' button').map((b) => b.text())).toEqual(['Sahkan', 'Gantung', 'Haramkan'])
    expect(w.get(t('admin-seller-status')).text()).toBe('Aktif')
  })

  it('an unknown seller returns to the list with a message', async () => {
    api.fetchAdminSeller.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' }))
    await mountAt(PenjualDetailPage, '/admin/marketplace/sellers/:id', '/admin/marketplace/sellers/99')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/marketplace/sellers')
    expect(queuedFlash()).toBe('Penjual tidak dijumpai.')
  })
})

describe('ProdukFormPage (P12-02..11)', () => {
  const detailOf = (extra: Row = {}) => ({
    ...product(7),
    description: 'Beg',
    shippingMethod: 'postage',
    shippingFee: '8.00',
    location: 'Kuala Lumpur',
    images: [
      { id: '70', position: 1, url: '/images/a.jpg' },
      { id: '71', position: 2, url: '/images/b.jpg' },
    ],
    updatedAt: '2026-02-09T12:00:00+08:00',
    ...extra,
  })

  const create = () => mountAt(ProdukFormPage, '/admin/marketplace/products/create', '/admin/marketplace/products/create', { mode: 'create' })
  const fill = async (w: VueWrapper, values: Record<string, string>) => {
    for (const [id, v] of Object.entries(values)) await w.get(t(id)).setValue(v)
  }
  const pick = (w: VueWrapper, files: File[]) => w.getComponent({ name: 'DsFileField' }).vm.$emit('update:modelValue', files)
  const png = (name = 'a.png', size = 10) => new File([new Uint8Array(size)], name, { type: 'image/png' })

  it('create: "Tambah Produk Marketplace", the official seller is the default, the options are the PRD ones', async () => {
    const w = await create()
    expect(w.get(t('admin-product-form-title')).text()).toBe('Tambah Produk Marketplace')
    expect(w.get<HTMLSelectElement>(t('mp-seller')).element.value).toBe('official')
    expect(w.findAll(`${t('mp-seller')} option`).map((o) => o.text())).toEqual(['PRESTASIPLUS Official (Admin)', 'JomBelajar Official'])
    expect(w.findAll(`${t('mp-shipping')} option`).map((o) => o.text())).toEqual(['Pilih kaedah', 'Ambil Sendiri', 'Pos / Kurier', 'COD', 'Percuma'])
    expect(w.text()).toContain('🆕 Baru')
    expect(w.text()).toContain('♻️ Terpakai')
    expect(w.text()).toContain('✅ Ada')
    expect(w.text()).toContain('❌ Habis')
    expect(w.text()).toContain('JPG, PNG, WEBP. Maks 2MB setiap gambar.')
    expect(w.text()).toContain('Untuk tunjukkan diskaun')
    // Status Produk is edit only.
    expect(w.find(t('mp-status')).exists()).toBe(false)
    expect(w.text()).toContain('Tambah Produk')
  })

  it('shows the PRD messages and does not call the API when the form is empty', async () => {
    const w = await create()
    await w.get('form').trigger('submit')
    await flushPromises()
    const errors = w.findAll(t('field-error')).map((e) => e.text())
    expect(errors).toContain('Nama produk diperlukan.')
    expect(errors).toContain('Kategori diperlukan.')
    expect(errors).toContain('Sila isi harga.')
    expect(errors).toContain('Sila pilih kaedah penghantaran.')
    expect(api.createAdminProduct).not.toHaveBeenCalled()
  })

  it('refuses an original price that is not greater than the price', async () => {
    const w = await create()
    await fill(w, { 'mp-name': 'Pen', 'mp-category': '4', 'mp-price': '10', 'mp-original-price': '10.00', 'mp-shipping': 'pickup' })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.findAll(t('field-error')).map((e) => e.text())).toEqual(['Harga asal mesti lebih besar daripada harga.'])
    expect(api.createAdminProduct).not.toHaveBeenCalled()
  })

  it('creates the product with the form values and the uploaded images, then goes to the list with a flash', async () => {
    api.createAdminProduct.mockResolvedValue({})
    api.uploadMarketplaceImage.mockResolvedValueOnce('/api/files/AAAAAAAAAAAAAAAAAAAAAA').mockResolvedValueOnce('/api/files/BBBBBBBBBBBBBBBBBBBBBB')
    const w = await create()
    await fill(w, { 'mp-name': ' Pen ', 'mp-category': '4', 'mp-price': '12.50', 'mp-original-price': '15', 'mp-shipping': 'pickup', 'mp-location': 'Ipoh' })
    await pick(w, [png('a.png'), png('b.png')])
    await flushPromises()
    expect(w.findAll(t('mp-added-image'))).toHaveLength(2)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.createAdminProduct).toHaveBeenCalledWith({
      sellerId: null,
      name: 'Pen',
      categoryId: '4',
      price: '12.50',
      originalPrice: '15',
      description: null,
      condition: 'new',
      stockStatus: 'available',
      shippingMethod: 'pickup',
      shippingFee: null,
      location: 'Ipoh',
      status: 'active',
      images: ['/api/files/AAAAAAAAAAAAAAAAAAAAAA', '/api/files/BBBBBBBBBBBBBBBBBBBBBB'],
    })
    expect(router.currentRoute.value.path).toBe('/admin/marketplace/products')
    expect(queuedFlash()).toBe('Produk berjaya ditambah.')
  })

  it('shows a 422 from the API under its field and keeps the input', async () => {
    api.createAdminProduct.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', fields: { sellerId: 'Penjual tidak sah.' } }),
    )
    const w = await create()
    await fill(w, { 'mp-name': 'Pen', 'mp-category': '4', 'mp-price': '12.50', 'mp-shipping': 'pickup' })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.findAll(t('field-error')).map((e) => e.text())).toEqual(['Penjual tidak sah.'])
    expect(w.get<HTMLInputElement>(t('mp-name')).element.value).toBe('Pen')
    expect(router.currentRoute.value.path).toBe('/admin/marketplace/products/create')
  })

  it('P12-09: a file of another type or over 2 MB is refused with the PRD text and not uploaded', async () => {
    const w = await create()
    await pick(w, [new File(['x'], 'a.gif', { type: 'image/gif' })])
    await flushPromises()
    expect(w.get(t('field-error')).text()).toBe('Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.')
    await pick(w, [png('big.png', 2 * 1024 * 1024 + 1)])
    await flushPromises()
    expect(w.get(t('field-error')).text()).toBe('Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.')
    expect(api.uploadMarketplaceImage).not.toHaveBeenCalled()
  })

  it('P12-09: the sixth image is refused with "Maksimum 5 gambar." and only five are uploaded', async () => {
    api.uploadMarketplaceImage.mockImplementation((f: File) => Promise.resolve(`/api/files/${f.name.padEnd(22, 'x').slice(0, 22)}`))
    const w = await create()
    await pick(w, ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => png(`${n}.png`)))
    await flushPromises()
    expect(api.uploadMarketplaceImage).toHaveBeenCalledTimes(5)
    expect(w.findAll(t('mp-added-image'))).toHaveLength(5)
    expect(w.get(t('field-error')).text()).toBe('Maksimum 5 gambar.')
  })

  it('an upload refused by the API shows its message under the images', async () => {
    api.uploadMarketplaceImage.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', fields: { images: 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.' } }),
    )
    const w = await create()
    await pick(w, [png()])
    await flushPromises()
    expect(w.get(t('field-error')).text()).toContain('Gambar mesti jenis')
    expect(w.findAll(t('mp-added-image'))).toHaveLength(0)
  })

  it('edit: loads the product, shows "Gambar Sedia Ada (2)" and the Status Produk radios', async () => {
    api.fetchAdminProduct.mockResolvedValue(detailOf())
    const w = await mountAt(ProdukFormPage, '/admin/marketplace/products/:id/edit', '/admin/marketplace/products/7/edit', { mode: 'edit' })
    expect(api.fetchAdminProduct).toHaveBeenCalledWith('7', expect.anything())
    expect(w.get<HTMLInputElement>(t('mp-name')).element.value).toBe('Produk 7')
    expect(w.get<HTMLInputElement>(t('mp-price')).element.value).toBe('35.00')
    expect(w.get(t('mp-existing-images')).text()).toContain('Gambar Sedia Ada (2)')
    expect(w.text()).toContain('🟢 Aktif')
    expect(w.text()).toContain('⏸️ Draf')
    expect(w.text()).toContain('🔴 Ditolak')
    expect(w.text()).toContain('Simpan Perubahan')
  })

  it('AC-ADM-P2-12.2: deleting one saved image is its own request and keeps the form and the other images', async () => {
    api.fetchAdminProduct.mockResolvedValue(detailOf())
    api.deleteAdminProductImage.mockResolvedValue(detailOf({ images: [{ id: '71', position: 2, url: '/images/b.jpg' }] }))
    const w = await mountAt(ProdukFormPage, '/admin/marketplace/products/:id/edit', '/admin/marketplace/products/7/edit', { mode: 'edit' })
    await w.get(t('mp-name')).setValue('Nama baharu')
    await w.findAll(t('mp-existing-image-delete'))[0]!.trigger('click')
    await flushPromises()
    expect(api.deleteAdminProductImage).toHaveBeenCalledWith('7', '70')
    expect(api.updateAdminProduct).not.toHaveBeenCalled()
    expect(w.findAll(t('mp-existing-image'))).toHaveLength(1)
    expect(w.get<HTMLInputElement>(t('mp-name')).element.value).toBe('Nama baharu')
    expect(flashText()).toBe('Gambar berjaya dipadam.')
  })

  it('edit: saved plus new images may not pass 5; Simpan Perubahan sends newImages and the status', async () => {
    api.fetchAdminProduct.mockResolvedValue(detailOf({ images: [1, 2, 3, 4].map((n) => ({ id: String(n), position: n, url: `/images/${String(n)}.jpg` })) }))
    api.updateAdminProduct.mockResolvedValue({})
    api.uploadMarketplaceImage.mockResolvedValue('/api/files/AAAAAAAAAAAAAAAAAAAAAA')
    const w = await mountAt(ProdukFormPage, '/admin/marketplace/products/:id/edit', '/admin/marketplace/products/7/edit', { mode: 'edit' })
    await pick(w, [png('a.png'), png('b.png')])
    await flushPromises()
    expect(api.uploadMarketplaceImage).toHaveBeenCalledTimes(1)
    expect(w.get(t('field-error')).text()).toBe('Maksimum 5 gambar.')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateAdminProduct).toHaveBeenCalledWith('7', expect.objectContaining({ status: 'active', newImages: ['/api/files/AAAAAAAAAAAAAAAAAAAAAA'] }))
    expect(queuedFlash()).toBe('Produk berjaya dikemas kini.')
    expect(router.currentRoute.value.path).toBe('/admin/marketplace/products')
  })

  it('edit: an unknown product returns to the list with a message', async () => {
    api.fetchAdminProduct.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' }))
    await mountAt(ProdukFormPage, '/admin/marketplace/products/:id/edit', '/admin/marketplace/products/99/edit', { mode: 'edit' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/marketplace/products')
    expect(queuedFlash()).toBe('Produk tidak dijumpai.')
  })
})
