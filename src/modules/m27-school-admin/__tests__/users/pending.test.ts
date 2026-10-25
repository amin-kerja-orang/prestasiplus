// @vitest-environment jsdom
/**
 * M27 S7b "Guru Menunggu Pengesahan" (docs/design/m27-pending-teacher-verify.md): list, empty state, verify success with
 * focus and aria-label, verify errors (404 and the defensive 409, 429, network), the S7 callout, the route guard and
 * the mock handlers. The client is mocked; the confirm falls back to `window.confirm` (no host mounted).
 */
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { ApiError } from '@/api'
import { decideAccess } from '@/app/router/guards'
import { setRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'
import { useFlashStore } from '@/stores/flash'

import type { PendingTeacherRow } from '../../api/pending-teachers'
import PendingTeacherCallout from '../../components/users/PendingTeacherCallout.vue'
import { UNCHECKED_NOTICE, confirmMessage, focusTargetAfter } from '../../components/users/pending-format'
import GuruMenungguPage from '../../pages/GuruMenungguPage.vue'
import guru from '../../routes/guru'
import { has, mountAt, text } from './helpers'

const api = vi.hoisted(() => ({
  fetchPendingTeachers: vi.fn(),
  verifyPendingTeacher: vi.fn(),
}))
vi.mock('../../api/pending-teachers', () => api)

const row = (over: Partial<PendingTeacherRow> = {}): PendingTeacherRow => ({
  id: '101',
  name: 'Guru Contoh Satu',
  initials: 'GC',
  email: 'satu@demo.test',
  phone: '0123456789',
  requestedAt: '2026-10-20T09:14:00+08:00',
  ...over,
})
const ROWS = [
  row(),
  row({ id: '102', name: 'Guru Contoh Dua', initials: 'GD', email: null, phone: null, requestedAt: '2026-10-20T11:02:00+08:00' }),
  row({ id: '103', name: 'Guru Contoh Tiga', initials: 'GT', email: 'tiga@demo.test' }),
]
const list = (rows: PendingTeacherRow[]) => ({
  data: rows,
  meta: { page: 1, pageSize: Math.max(1, rows.length), totalItems: rows.length, totalPages: 1 },
})
const VERIFIED = { data: { id: '101', isActive: true, schoolId: '900001' }, status: 'Guru berjaya disahkan.' }

async function mountPage(rows: PendingTeacherRow[] = ROWS) {
  api.fetchPendingTeachers.mockResolvedValue(list(rows))
  const out = await mountAt(GuruMenungguPage, '/admin-sekolah/guru/menunggu')
  return out
}

const verifyButtons = (w: Awaited<ReturnType<typeof mountPage>>['wrapper']) =>
  w.findAll('[data-testid="pt-verify"]')
const flashes = () => useFlashStore().current ?? { type: undefined, message: undefined }

beforeEach(() => {
  vi.restoreAllMocks()
  for (const fn of Object.values(api)) fn.mockReset()
  setRouteOutcome(null)
  usePageMeta().reset()
  document.body.innerHTML = ''
})

describe('S7b list', () => {
  it('sets the header, shows the count, the found line and one verify button per row', async () => {
    const { wrapper: w } = await mountPage()
    expect(usePageMeta().state.header).toEqual({
      title: 'Guru Menunggu Pengesahan',
      subtitle: 'SMK Contoh Ujian',
    })
    expect(text(w, 'pt-count-card')).toContain('Menunggu Pengesahan')
    expect(text(w, 'pt-found')).toBe('3 guru menunggu pengesahan')
    expect(w.get('[data-testid="pt-back"]').attributes('href')).toBe('/admin-sekolah/guru')
    expect(verifyButtons(w)).toHaveLength(3)
    expect(has(w, 'pt-empty')).toBe(false)
  })

  it('shows "-" for an empty e-mail or phone and a dd/mm/yyyy HH:mm date', async () => {
    const { wrapper: w } = await mountPage()
    const html = w.text()
    expect(html).toContain('20/10/2026 09:14')
    expect(w.findAll('[data-testid="pt-email"]')[1]?.text()).toBe('-')
    expect(w.findAll('[data-testid="pt-phone"]')[1]?.text()).toBe('-')
  })

  it('every verify button has the accessible name "Sahkan {nama}" and its row id', async () => {
    const { wrapper: w } = await mountPage()
    const labels = verifyButtons(w).map((b) => b.attributes('aria-label'))
    expect(labels).toEqual(['Sahkan Guru Contoh Satu', 'Sahkan Guru Contoh Dua', 'Sahkan Guru Contoh Tiga'])
    expect(verifyButtons(w).map((b) => b.attributes('data-user-id'))).toEqual(['101', '102', '103'])
  })

  it('shows a tile skeleton with a height while loading', async () => {
    api.fetchPendingTeachers.mockReturnValue(new Promise(() => {}))
    const { wrapper: w } = await mountAt(GuruMenungguPage, '/admin-sekolah/guru/menunggu')
    expect(w.get('[data-testid="pt-loading"]').classes()).toContain('h-24')
  })

  it('exposes pt-name in both the table and the card variant', async () => {
    const { wrapper: w } = await mountPage()
    const names = w.findAll('[data-testid="pt-name"]').map((n) => n.text())
    expect(names.filter((n) => n === 'Guru Contoh Satu').length).toBeGreaterThanOrEqual(1)
    expect(names).toContain('Guru Contoh Tiga')
    const cards = w.findAll('[data-testid="pt-row"]')
    expect(cards.length).toBeGreaterThanOrEqual(3)
    for (const c of cards) expect(c.find('[data-testid="pt-name"]').exists()).toBe(true)
  })

  it('prints its own h1 with the pt-heading test id and a tab stop for focus', async () => {
    const { wrapper: w } = await mountPage()
    const h1 = w.get('h1[data-testid="pt-heading"]')
    expect(h1.text()).toBe('Guru Menunggu Pengesahan')
    expect(h1.attributes('tabindex')).toBe('-1')
    expect(h1.classes()).toContain('sr-only')
    expect(w.findAll('h1')).toHaveLength(1)
  })

  it('warns above the list that the e-mail and phone are unchecked (#208 follow-up)', async () => {
    const { wrapper: w } = await mountPage()
    expect(text(w, 'pt-notice')).toBe(UNCHECKED_NOTICE)
    expect(UNCHECKED_NOTICE).toBe(
      'Emel dan telefon di bawah diisi sendiri oleh pendaftar dan belum disemak. Sahkan hanya guru yang anda pasti bertugas di sekolah ini.',
    )
  })

  it('hides the unchecked-details notice when nothing is pending or the load failed', async () => {
    const { wrapper: empty } = await mountPage([])
    expect(has(empty, 'pt-notice')).toBe(false)
    api.fetchPendingTeachers.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }))
    const { wrapper: failed } = await mountAt(GuruMenungguPage, '/admin-sekolah/guru/menunggu')
    expect(has(failed, 'pt-notice')).toBe(false)
  })

  it('shows the empty state with its copy and no table', async () => {
    const { wrapper: w } = await mountPage([])
    expect(has(w, 'pt-empty')).toBe(true)
    expect(text(w, 'pt-empty')).toContain('Tiada guru menunggu pengesahan')
    expect(text(w, 'pt-empty')).toContain('Guru yang mendaftar sendiri dan memilih sekolah ini akan muncul di sini.')
    expect(text(w, 'pt-found')).toBe('0 guru menunggu pengesahan')
    expect(has(w, 'pt-table')).toBe(false)
  })

  it('shows the load error with a retry', async () => {
    api.fetchPendingTeachers.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }))
    const { wrapper: w } = await mountAt(GuruMenungguPage, '/admin-sekolah/guru/menunggu')
    expect(text(w, 'pt-error')).toContain('Ralat berlaku. Sila cuba lagi.')
    expect(has(w, 'pt-table')).toBe(false)
  })

  it('a 403 on load renders the global 403 page in place', async () => {
    api.fetchPendingTeachers.mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Tidak dibenarkan.' }))
    const { wrapper: w } = await mountAt(GuruMenungguPage, '/admin-sekolah/guru/menunggu')
    expect(has(w, 'pt-error')).toBe(false)
    const { useRouteOutcome } = await import('@/app/router/outcome')
    expect(useRouteOutcome().value).toBe(403)
  })
})

describe('S7b verify', () => {
  const confirmWith = (answer: boolean) => vi.spyOn(window, 'confirm').mockReturnValue(answer)

  async function mountAttached(rows: PendingTeacherRow[] = ROWS) {
    api.fetchPendingTeachers.mockResolvedValue(list(rows))
    const host = document.createElement('div')
    document.body.append(host)
    const out = await mountAt(GuruMenungguPage, '/admin-sekolah/guru/menunggu', {}, host)
    return out
  }

  it('asks the confirm with the exact message and does nothing on cancel', async () => {
    const confirm = confirmWith(false)
    const { wrapper: w } = await mountPage()
    await verifyButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(
      'Sahkan Guru Contoh Satu sebagai guru sekolah ini? Emel: satu@demo.test. Telefon: 0123456789. ' +
        'Tarikh Daftar: 20/10/2026 09:14. Butiran ini diisi sendiri oleh pendaftar dan belum disemak. ' +
        'Sahkan hanya jika anda pasti guru ini bertugas di sekolah ini. Akaun akan diaktifkan dan guru akan dimaklumkan.',
    )
    expect(api.verifyPendingTeacher).not.toHaveBeenCalled()
  })

  it('success verifies the id, reloads without the row, flashes the server text and focuses the next row', async () => {
    confirmWith(true)
    api.verifyPendingTeacher.mockResolvedValue(VERIFIED)
    const { wrapper: w } = await mountAttached()
    api.fetchPendingTeachers.mockResolvedValue(list([ROWS[1]!, ROWS[2]!]))
    await verifyButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(api.verifyPendingTeacher).toHaveBeenCalledWith('101')
    expect(verifyButtons(w)).toHaveLength(2)
    expect(text(w, 'pt-found')).toBe('2 guru menunggu pengesahan')
    expect(flashes().message).toEqual('Guru berjaya disahkan.')
    expect(document.activeElement?.getAttribute('data-user-id')).toBe('102')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Sahkan Guru Contoh Dua')
    w.unmount()
  })

  it('removing the last row moves focus to the previous row', async () => {
    confirmWith(true)
    api.verifyPendingTeacher.mockResolvedValue(VERIFIED)
    const { wrapper: w } = await mountAttached()
    api.fetchPendingTeachers.mockResolvedValue(list([ROWS[0]!, ROWS[1]!]))
    await verifyButtons(w)[2]!.trigger('click')
    await flushPromises()
    expect(document.activeElement?.getAttribute('data-user-id')).toBe('102')
    w.unmount()
  })

  it('removing the only row shows the empty state and moves focus to the page heading', async () => {
    confirmWith(true)
    api.verifyPendingTeacher.mockResolvedValue(VERIFIED)
    const { wrapper: w } = await mountAttached([ROWS[0]!])
    api.fetchPendingTeachers.mockResolvedValue(list([]))
    await verifyButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(has(w, 'pt-empty')).toBe(true)
    expect(document.activeElement?.getAttribute('data-testid')).toBe('pt-heading')
    expect(document.activeElement?.tagName).toBe('H1')
    w.unmount()
  })

  it.each([404, 409])('a %i shows the "tidak lagi menunggu" copy, reloads and drops the stale row', async (status) => {
    confirmWith(true)
    api.verifyPendingTeacher.mockRejectedValue(new ApiError({ status, code: 'NOT_FOUND', message: 'Not Found.' }))
    const { wrapper: w } = await mountPage()
    api.fetchPendingTeachers.mockResolvedValue(list([ROWS[1]!, ROWS[2]!]))
    await verifyButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(flashes().type).toBe('error')
    expect(flashes().message).toEqual('Guru ini tidak lagi menunggu pengesahan. Senarai telah dikemas kini.')
    expect(JSON.stringify(flashes())).not.toContain('Not Found')
    expect(verifyButtons(w)).toHaveLength(2)
  })

  it('429 keeps the row and shows the server message', async () => {
    confirmWith(true)
    api.verifyPendingTeacher.mockRejectedValue(
      new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'Terlalu banyak percubaan. Sila cuba sebentar lagi.' }),
    )
    const { wrapper: w } = await mountPage()
    await verifyButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(flashes().message).toEqual(['Terlalu banyak percubaan. Sila cuba sebentar lagi.'])
    expect(verifyButtons(w)).toHaveLength(3)
    expect(api.fetchPendingTeachers).toHaveBeenCalledTimes(1)
  })

  it('a network failure shows the generic copy and keeps the row', async () => {
    confirmWith(true)
    api.verifyPendingTeacher.mockRejectedValue(new Error('boom'))
    const { wrapper: w } = await mountPage()
    await verifyButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(flashes().message).toEqual(['Ralat berlaku. Sila cuba lagi.'])
    expect(verifyButtons(w)).toHaveLength(3)
  })

  it('still reports success when the reload after the write fails', async () => {
    confirmWith(true)
    api.verifyPendingTeacher.mockResolvedValue(VERIFIED)
    const { wrapper: w } = await mountPage()
    api.fetchPendingTeachers.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }))
    await verifyButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(flashes().type).toBe('success')
    expect(flashes().message).toEqual('Guru berjaya disahkan.')
    expect(has(w, 'pt-error')).toBe(true)
  })
})

describe('focusTargetAfter', () => {
  it('prefers the next row, then the previous, then null', () => {
    expect(focusTargetAfter(['1', '2', '3'], '1', ['2', '3'])).toBe('2')
    expect(focusTargetAfter(['1', '2', '3'], '3', ['1', '2'])).toBe('2')
    expect(focusTargetAfter(['1'], '1', [])).toBeNull()
    expect(focusTargetAfter(['1', '2', '3'], '2', ['1'])).toBe('1')
  })
})

describe('S7 callout', () => {
  it('shows the count and the "Semak" link to S7b when n > 0', async () => {
    api.fetchPendingTeachers.mockResolvedValue(list(ROWS))
    const { wrapper: w } = await mountAt(PendingTeacherCallout, '/admin-sekolah/guru')
    expect(text(w, 'pt-callout-count')).toBe('3 guru menunggu pengesahan')
    const link = w.get('[data-testid="pt-callout-link"]')
    expect(link.text()).toBe('Semak')
    expect(link.attributes('href')).toBe('/admin-sekolah/guru/menunggu')
  })

  it('makes the "Semak" button full width below sm and 44 px high', async () => {
    api.fetchPendingTeachers.mockResolvedValue(list(ROWS))
    const { wrapper: w } = await mountAt(PendingTeacherCallout, '/admin-sekolah/guru')
    expect(w.get('[data-testid="pt-callout-link"]').classes()).toEqual(
      expect.arrayContaining(['min-h-11', 'w-full', 'justify-center', 'sm:w-auto']),
    )
  })

  it.each([
    ['empty', () => api.fetchPendingTeachers.mockResolvedValue(list([]))],
    ['failing', () => api.fetchPendingTeachers.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))],
  ])('is hidden when the list is %s', async (_n, arrange) => {
    arrange()
    const { wrapper: w } = await mountAt(PendingTeacherCallout, '/admin-sekolah/guru')
    expect(has(w, 'pt-callout')).toBe(false)
  })
})

describe('S7b route', () => {
  const pending = guru.find((r) => r.path === '/admin-sekolah/guru/menunggu')!
  const to = { path: pending.path, meta: pending.meta, name: pending.name } as unknown as RouteLocationNormalized

  it('is a school_admin-only user-shell route with the exact titles, before :id and /baru', () => {
    expect(pending.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Guru Menunggu Pengesahan - PRESTASIPLUS',
      header: { title: 'Guru Menunggu Pengesahan' },
      ownsH1: true,
      module: 'M27',
    })
    const paths = guru.map((r) => r.path)
    expect(paths.indexOf(pending.path)).toBeLessThan(paths.indexOf('/admin-sekolah/guru/:id(\\d+)'))
  })

  it.each(['student', 'teacher', 'admin'] as const)('refuses %s with the 403 page', (role) => {
    expect(decideAccess(to, { isLoggedIn: true, role, landingPath: '/dashboard' })).toEqual({ kind: 'in-place', status: 403 })
  })

  it('sends a guest to the login and lets a school_admin in', () => {
    expect(decideAccess(to, { isLoggedIn: false, role: null, landingPath: null })).toEqual({ kind: 'redirect', to: '/login' })
    expect(decideAccess(to, { isLoggedIn: true, role: 'school_admin', landingPath: '/admin-sekolah' })).toEqual({ kind: 'allow' })
  })
})

describe('confirmMessage (#208 follow-up)', () => {
  const tail =
    'Butiran ini diisi sendiri oleh pendaftar dan belum disemak. ' +
    'Sahkan hanya jika anda pasti guru ini bertugas di sekolah ini. Akaun akan diaktifkan dan guru akan dimaklumkan.'

  it('repeats the e-mail, phone and registration date the admin can check', () => {
    expect(
      confirmMessage({ name: 'Guru Contoh', email: 'guru@demo.test', phone: '0123456789', requestedAt: '20/10/2026 09:14' }),
    ).toBe(
      `Sahkan Guru Contoh sebagai guru sekolah ini? Emel: guru@demo.test. Telefon: 0123456789. Tarikh Daftar: 20/10/2026 09:14. ${tail}`,
    )
  })

  it('leaves out a missing e-mail or phone instead of printing "-"', () => {
    expect(confirmMessage({ name: 'Guru Contoh', email: '-', phone: '-', requestedAt: '20/10/2026 11:02' })).toBe(
      `Sahkan Guru Contoh sebagai guru sekolah ini? Tarikh Daftar: 20/10/2026 11:02. ${tail}`,
    )
    expect(confirmMessage({ name: 'Guru Contoh', email: 'guru@demo.test', phone: '', requestedAt: '20/10/2026 11:02' })).toBe(
      `Sahkan Guru Contoh sebagai guru sekolah ini? Emel: guru@demo.test. Tarikh Daftar: 20/10/2026 11:02. ${tail}`,
    )
  })

  it('the row dialog for a teacher without contact details still names the teacher and the date', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper: w } = await mountPage()
    await verifyButtons(w)[1]!.trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(
      `Sahkan Guru Contoh Dua sebagai guru sekolah ini? Tarikh Daftar: 20/10/2026 11:02. ${tail}`,
    )
    expect(api.verifyPendingTeacher).not.toHaveBeenCalled()
  })
})
