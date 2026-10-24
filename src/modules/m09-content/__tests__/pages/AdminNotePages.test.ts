// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { usePageMeta } from '@/composables'
import { useFlashStore } from '@/stores/flash'

import type { AdminNoteDetail, AdminNoteItem } from '../../api/admin-articles-notes'
import AdminNoteFormPage from '../../pages/AdminNoteFormPage.vue'
import AdminNoteListPage from '../../pages/AdminNoteListPage.vue'
import AdminNotePreviewPage from '../../pages/AdminNotePreviewPage.vue'
import { chooseRowAction, menuItem, openRowMenu } from '../menu'

const api = vi.hoisted(() => ({
  fetchAdminNotes: vi.fn(),
  fetchAdminNote: vi.fn(),
  createAdminNote: vi.fn(),
  updateAdminNote: vi.fn(),
  deleteAdminNote: vi.fn(),
}))
vi.mock('../../api/admin-articles-notes', () => api)

function item(id: number, extra: Partial<AdminNoteItem> = {}): AdminNoteItem {
  return {
    id,
    title: `Nota ${String(id)}`,
    subject: 'matematik',
    noteType: 'FORMULA',
    grade: 'TINGKATAN_4',
    isPublished: true,
    views: 0,
    downloads: 0,
    author: { id: 1, name: 'Admin Demo' },
    ...extra,
  }
}

const NOTE: AdminNoteDetail = {
  ...item(1, { title: 'Sifir 1 hingga 12 — Carta Lengkap' }),
  summary: 'Carta sifir.',
  content: '<h2>Sifir 1 hingga 12</h2> <p>Sifir adalah asas.</p>',
  createdAt: '2026-02-06T10:00:00+08:00',
}

function listResult(rows: AdminNoteItem[], total = rows.length) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 20,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 20)),
      from: rows.length ? 1 : null,
      to: rows.length || null,
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router
let confirmSpy: ReturnType<typeof vi.spyOn>

async function mountAt(
  component: Component,
  url: string,
  props: Record<string, unknown> = {},
): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/notes', name: 'm09.admin.notes.list', component: AdminNoteListPage },
      {
        path: '/admin/notes/create',
        name: 'm09.admin.notes.create',
        component: { template: '<i/>' },
      },
      { path: '/admin/notes/:id', component: { template: '<i/>' } },
      { path: '/admin/notes/:id/edit', component: { template: '<i/>' } },
      { path: '/form', component: { template: '<i/>' } },
    ],
  })
  await router.push(url)
  wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function t(w: VueWrapper, id: string) {
  return w.get(`[data-testid=${id}]`)
}

function el<T extends Element>(w: VueWrapper, id: string): T {
  return t(w, id).element as unknown as T
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  usePageMeta().reset()
  api.fetchAdminNotes.mockResolvedValue(
    listResult([
      item(1),
      item(2, {
        title: 'B'.repeat(50),
        subject: 'bahasa_melayu',
        noteType: 'TIPS_TRICKS',
        grade: 'TINGKATAN_5',
        isPublished: false,
        views: 3,
        downloads: 2,
      }),
    ]),
  )
  api.fetchAdminNote.mockResolvedValue(NOTE)
})

afterEach(() => {
  confirmSpy.mockRestore()
  wrapper?.unmount()
  wrapper = null
})

describe('AdminNoteListPage (M09 S5)', () => {
  it('shows the count, the add link, the headers and the row cells', async () => {
    const w = await mountAt(AdminNoteListPage, '/admin/notes')
    expect(t(w, 'admin-notes-count').text()).toBe('Jumlah: 2 nota')
    expect(t(w, 'admin-notes-add').text()).toBe('Tambah Nota')
    expect(t(w, 'admin-notes-add').attributes('href')).toBe('/admin/notes/create')
    expect(w.findAll('thead th').map((h) => h.text())).toEqual([
      'Tajuk',
      'Subjek',
      'Jenis',
      'Tahap',
      'Status',
      'Statistik',
      'Tindakan',
    ])
    const rows = w.findAll('tbody tr')
    expect(rows[0]!.find('[data-testid=note-subject]').text()).toBe('MATEMATIK')
    expect(rows[0]!.find('[data-testid=note-type]').text()).toBe('FORMULA')
    expect(rows[0]!.find('[data-testid=note-grade]').text()).toBe('TINGKATAN 4')
    expect(rows[0]!.find('[data-testid=status-pill]').text()).toBe('Diterbitkan')
    expect(rows[0]!.find('[data-testid=note-author]').text()).toBe('Oleh: Admin Demo')
    expect(rows[1]!.find('[data-testid=note-title]').text()).toBe(`${'B'.repeat(40)}...`)
    expect(rows[1]!.find('[data-testid=note-subject]').text()).toBe('BAHASA MELAYU')
    expect(rows[1]!.find('[data-testid=note-views]').text()).toBe('3 tontonan')
    expect(rows[1]!.find('[data-testid=note-downloads]').text()).toBe('2 muat turun')
    expect(rows[1]!.find('[data-testid=status-pill]').text()).toBe('Draf')
  })

  it('has the filter options with the live labels (DV-M09-06)', async () => {
    const w = await mountAt(AdminNoteListPage, '/admin/notes')
    expect(t(w, 'admin-notes-search').attributes('placeholder')).toBe('Cari nota...')
    expect(w.findAll('[data-testid=admin-notes-subject] option').map((o) => o.text())).toEqual([
      'Semua Subjek',
      'Matematik',
      'Matematik Tambahan',
      'Sains',
      'Fizik',
      'Kimia',
      'Biologi',
      'Bahasa Melayu',
      'Bahasa Inggeris',
      'Sejarah',
    ])
    expect(w.findAll('[data-testid=admin-notes-type] option').map((o) => o.text())).toEqual([
      'Semua Jenis',
      'Ringkasan',
      'Mind Map',
      'Flashcard',
      'Cheat Sheet',
      'Nota Penuh',
    ])
  })

  it('reads the URL (note_type) into the controls and the query', async () => {
    const w = await mountAt(
      AdminNoteListPage,
      '/admin/notes?subject=sains&note_type=summary&search=a',
    )
    expect(el<HTMLSelectElement>(w, 'admin-notes-subject').value).toBe('sains')
    expect(el<HTMLSelectElement>(w, 'admin-notes-type').value).toBe('summary')
    expect(api.fetchAdminNotes).toHaveBeenCalledWith(
      { search: 'a', subject: 'sains', noteType: 'summary', page: 1 },
      expect.anything(),
    )
  })

  it('submits the filter as a note_type query', async () => {
    const w = await mountAt(AdminNoteListPage, '/admin/notes')
    await t(w, 'admin-notes-type').setValue('full_notes')
    await t(w, 'admin-notes-filter').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ note_type: 'full_notes' })
  })

  it('shows "Tiada nota dijumpai." and "Jumlah: 0 nota" for no match', async () => {
    api.fetchAdminNotes.mockResolvedValue(listResult([]))
    const w = await mountAt(AdminNoteListPage, '/admin/notes?note_type=mind_map')
    expect(t(w, 'admin-notes-empty').text()).toContain('Tiada nota dijumpai.')
    expect(t(w, 'admin-notes-count').text()).toBe('Jumlah: 0 nota')
  })

  it('links the row actions and confirms before deleting', async () => {
    const w = await mountAt(AdminNoteListPage, '/admin/notes')
    const items = await openRowMenu(w, 0)
    expect(menuItem(items, 'Padam')).toBeDefined()
    expect(w.find('a[href="/admin/notes/1/edit"]').exists()).toBe(true)
    expect(menuItem(items, 'Lihat')?.getAttribute('href')).toBe('/admin/notes/1')

    confirmSpy.mockReturnValue(false)
    await chooseRowAction(w, 0, 'Padam')
    expect(confirmSpy).toHaveBeenCalledWith('Adakah anda pasti mahu padam nota ini?')
    expect(api.deleteAdminNote).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    api.deleteAdminNote.mockResolvedValue({ data: { deleted: 1 }, status: 'Nota berjaya dipadam.' })
    await chooseRowAction(w, 0, 'Padam')
    expect(api.deleteAdminNote).toHaveBeenCalledWith(1)
    expect(useFlashStore().current?.message).toBe('Nota berjaya dipadam.')
  })

  it('shows a pager (with filters) only above one page', async () => {
    api.fetchAdminNotes.mockResolvedValue(listResult([item(1)], 25))
    const w = await mountAt(AdminNoteListPage, '/admin/notes?subject=sains')
    const next = w.findAll('button').find((b) => b.text() === '2')
    expect(next).toBeDefined()
    await next!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ subject: 'sains', page: '2' })
  })
})

describe('AdminNoteFormPage (M09 S6/S7, DV-M09-01)', () => {
  it('create: shows the form (not a 500 page) with required fields and options', async () => {
    const w = await mountAt(AdminNoteFormPage, '/form', { mode: 'create' })
    expect(w.text()).not.toContain('Ralat Pelayan')
    expect(w.get('[data-ds=back-link]').attributes('href')).toBe('/admin/notes')
    expect(el<HTMLInputElement>(w, 'note-title').required).toBe(true)
    expect(el<HTMLTextAreaElement>(w, 'note-content').required).toBe(true)
    expect(el<HTMLTextAreaElement>(w, 'note-content').rows).toBe(15)
    expect([...el<HTMLSelectElement>(w, 'note-subject').options].map((o) => o.text)).toEqual([
      'Pilih subjek',
      'Matematik',
      'Matematik Tambahan',
      'Sains',
      'Fizik',
      'Kimia',
      'Biologi',
      'Bahasa Melayu',
      'Bahasa Inggeris',
      'Sejarah',
    ])
    expect([...el<HTMLSelectElement>(w, 'note-type').options].map((o) => o.text).slice(1)).toEqual([
      'FORMULA',
      'RINGKASAN',
      'LENGKAP',
      'TIPS_TRICKS',
    ])
    expect([...el<HTMLSelectElement>(w, 'note-grade').options].map((o) => o.text).slice(1)).toEqual(
      ['Tingkatan 4', 'Tingkatan 5'],
    )
    expect(t(w, 'form-submit').text()).toBe('Simpan Nota')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/admin/notes')
    const form = el<HTMLFormElement>(w, 'admin-note-form')
    expect(form.checkValidity()).toBe(false)
    for (const id of ['note-title', 'note-content', 'note-subject', 'note-type', 'note-grade']) {
      expect(
        el<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(w, id).validity.valueMissing,
      ).toBe(true)
    }
  })

  it('create: posts the body, queues the flash and returns to S5', async () => {
    api.createAdminNote.mockResolvedValue({ data: NOTE, status: 'Nota berjaya ditambah.' })
    const w = await mountAt(AdminNoteFormPage, '/form', { mode: 'create' })
    await t(w, 'note-title').setValue('Nota Sains')
    await t(w, 'note-content').setValue('<p>Isi</p>')
    await t(w, 'note-subject').setValue('sains')
    await t(w, 'note-type').setValue('RINGKASAN')
    await t(w, 'note-grade').setValue('TINGKATAN_5')
    await t(w, 'note-published').trigger('click')
    await t(w, 'admin-note-form').trigger('submit')
    await flushPromises()
    expect(api.createAdminNote).toHaveBeenCalledWith({
      title: 'Nota Sains',
      summary: null,
      content: '<p>Isi</p>',
      subject: 'sains',
      noteType: 'RINGKASAN',
      grade: 'TINGKATAN_5',
      isPublished: true,
    })
    expect(router.currentRoute.value.path).toBe('/admin/notes')
    expect(useFlashStore().pending).toEqual({ type: 'success', message: 'Nota berjaya ditambah.' })
  })

  it('create: 422 shows the field message under the field and keeps the input', async () => {
    api.createAdminNote.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Invalid',
        fields: { subject: 'Medan ini tidak sah.' },
      }),
    )
    const w = await mountAt(AdminNoteFormPage, '/form', { mode: 'create' })
    await t(w, 'note-title').setValue('N')
    await t(w, 'admin-note-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'field-error').text()).toBe('Medan ini tidak sah.')
    expect(el<HTMLInputElement>(w, 'note-title').value).toBe('N')
  })

  it('edit: pre-fills note 1, no placeholders, "Kemaskini Nota"', async () => {
    const w = await mountAt(AdminNoteFormPage, '/form', { mode: 'edit', id: '1' })
    expect(api.fetchAdminNote).toHaveBeenCalledWith(1, expect.anything())
    expect(el<HTMLInputElement>(w, 'note-title').value).toBe('Sifir 1 hingga 12 — Carta Lengkap')
    expect(el<HTMLTextAreaElement>(w, 'note-summary').value).toBe('Carta sifir.')
    expect(el<HTMLSelectElement>(w, 'note-subject').value).toBe('matematik')
    expect(el<HTMLSelectElement>(w, 'note-type').value).toBe('FORMULA')
    expect(el<HTMLSelectElement>(w, 'note-grade').value).toBe('TINGKATAN_4')
    expect(el<HTMLSelectElement>(w, 'note-subject').options).toHaveLength(9)
    expect(el<HTMLFormElement>(w, 'admin-note-form').checkValidity()).toBe(true)
    expect(t(w, 'form-submit').text()).toBe('Kemaskini Nota')
  })

  it('edit: PUTs and returns to the list; an unknown id returns WITHOUT a flash', async () => {
    api.updateAdminNote.mockResolvedValue({ data: NOTE, status: 'Nota berjaya dikemaskini.' })
    const w = await mountAt(AdminNoteFormPage, '/form', { mode: 'edit', id: '1' })
    await t(w, 'admin-note-form').trigger('submit')
    await flushPromises()
    expect(api.updateAdminNote).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ grade: 'TINGKATAN_4' }),
    )
    expect(router.currentRoute.value.path).toBe('/admin/notes')
    wrapper?.unmount()

    useFlashStore().clear()
    api.fetchAdminNote.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    await mountAt(AdminNoteFormPage, '/form', { mode: 'edit', id: '9999' })
    expect(router.currentRoute.value.path).toBe('/admin/notes')
    expect(useFlashStore().pending).toBeNull()
  })
})

describe('AdminNotePreviewPage (M09 S8)', () => {
  it('shows the card, the detail grid, the escaped body and the edit link', async () => {
    const w = await mountAt(AdminNotePreviewPage, '/form', { id: '1' })
    expect(t(w, 'preview-title').text()).toBe('Sifir 1 hingga 12 — Carta Lengkap')
    expect(t(w, 'preview-author').text()).toBe('Admin Demo')
    expect(t(w, 'preview-date').text()).toBe('06 Feb 2026')
    expect(t(w, 'preview-views').text()).toBe('0 tontonan')
    expect(t(w, 'preview-downloads').text()).toBe('0 muat turun')
    expect(t(w, 'status-pill').text()).toBe('Diterbitkan')
    expect(t(w, 'preview-summary').text()).toBe('Carta sifir.')
    expect(t(w, 'preview-subject').text()).toBe('MATEMATIK')
    expect(t(w, 'preview-grade').text()).toBe('TINGKATAN 4')
    expect(t(w, 'preview-type').text()).toBe('FORMULA')
    const body = t(w, 'preview-body')
    expect(body.text().startsWith('<h2>Sifir 1 hingga 12</h2>')).toBe(true)
    expect(body.find('h2').exists()).toBe(false)
    expect(body.classes()).toContain('break-words')
    expect(t(w, 'preview-edit').text()).toBe('Edit Nota')
    expect(t(w, 'preview-edit').attributes('href')).toBe('/admin/notes/1/edit')
    expect(usePageMeta().state.header).toEqual({
      title: 'Sifir 1 hingga 12 — Carta Lengkap',
      subtitle: 'Paparan nota',
    })
  })

  it('returns to the list without a flash for an unknown or non-numeric id', async () => {
    api.fetchAdminNote.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    await mountAt(AdminNotePreviewPage, '/form', { id: '9999' })
    expect(router.currentRoute.value.path).toBe('/admin/notes')
    expect(useFlashStore().pending).toBeNull()
    wrapper?.unmount()

    api.fetchAdminNote.mockClear()
    await mountAt(AdminNotePreviewPage, '/form', { id: 'abc' })
    expect(api.fetchAdminNote).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/admin/notes')
  })
})
