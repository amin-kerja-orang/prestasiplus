// @vitest-environment jsdom
/**
 * "Tanda Karangan (semakan AI)" (V2 Panel `/spm/tanda-karangan`): the card per proposal with V2's labels, the empty
 * state, confirm (marks sent, flash, reload), the AI proposal as the starting mark, a refused confirm, the load error,
 * the two doors (school admin / Admin Pusat) and the route guard. The client is mocked.
 */
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { ApiError } from '@/api'
import { decideAccess } from '@/app/router/guards'
import { usePageMeta } from '@/composables/usePageMeta'
import { useFlashStore } from '@/stores/flash'

import type { EssayReviewRow } from '../../api/essay-review'
import TandaKaranganPage from '../../pages/TandaKaranganPage.vue'
import karangan from '../../routes/karangan'
import { has, mountAt, text } from './helpers'

const api = vi.hoisted(() => ({
  fetchEssayReview: vi.fn(),
  confirmEssayMark: vi.fn(),
  essayReviewBase: vi.fn(),
}))
vi.mock('../../api/essay-review', () => api)

const row = (over: Partial<EssayReviewRow> = {}): EssayReviewRow => ({
  id: '11',
  student: 'Murid Contoh Satu',
  questionNo: '2(a)',
  stem: 'Tulis sebuah karangan tentang sekolah.',
  marks: 20,
  proposed: 12,
  rationale: 'Isi mencukupi.',
  points: [{ id: 1, covered: true, awarded: 3 }],
  scheme: ['Pengenalan', 'Isi pertama'],
  essay: 'Sekolah saya bersih. <b>Tiada tag</b>',
  ...over,
})
const list = (rows: EssayReviewRow[]) => ({
  data: rows,
  meta: { page: 1, pageSize: 20, totalItems: rows.length, totalPages: 1 },
})

async function mountPage(rows: EssayReviewRow[], url = '/admin-sekolah/tanda-karangan') {
  api.fetchEssayReview.mockResolvedValue(list(rows))
  return mountAt(TandaKaranganPage, url)
}

beforeEach(() => {
  vi.restoreAllMocks()
  for (const fn of Object.values(api)) fn.mockReset()
  usePageMeta().reset()
  document.body.innerHTML = ''
})

describe('Tanda Karangan list', () => {
  it('prints V2 copy: heading, count, intro, and per card the labels, escaped', async () => {
    const { wrapper: w } = await mountPage([row(), row({ id: '12', student: 'Murid Contoh Dua', proposed: null, rationale: '' })])
    expect(text(w, 'tk-head')).toContain('Tanda Karangan (semakan AI)')
    expect(text(w, 'tk-count')).toBe('2 menunggu')
    expect(text(w, 'tk-intro')).toBe(
      'AI mencadangkan markah untuk setiap karangan berdasarkan skema. Sahkan atau laraskan — markah hanya dikira setelah cikgu mengesahkan.',
    )
    const cards = w.findAll('[data-testid="tk-card"]')
    expect(cards).toHaveLength(2)
    const first = cards[0]!.text()
    expect(first).toContain('Murid Contoh Satu')
    expect(first).toContain('· Soalan 2(a)')
    expect(first).toContain('Cadangan AI: 12 / 20')
    expect(first).toContain('Skema')
    expect(first).toContain('Jawapan pelajar')
    expect(first).toContain('Justifikasi AI: Isi mencukupi.')
    expect(first).toContain('Markah muktamad')
    expect(first).toContain('Sahkan')
    // The pupil's answer is text, never markup.
    expect(cards[0]!.find('[data-testid="tk-essay"]').text()).toContain('<b>Tiada tag</b>')
    expect(cards[0]!.find('[data-testid="tk-essay"] b').exists()).toBe(false)
    // No proposal: a dash, and no rationale box.
    expect(cards[1]!.text()).toContain('Cadangan AI: — / 20')
    expect(cards[1]!.find('[data-testid="tk-rationale"]').exists()).toBe(false)
    expect(has(w, 'tk-empty')).toBe(false)
  })

  it('shows the empty state of V2', async () => {
    const { wrapper: w } = await mountPage([])
    expect(text(w, 'tk-empty')).toBe('Tiada karangan menunggu semakan.')
    expect(text(w, 'tk-count')).toBe('0 menunggu')
  })

  it('shows a retry state when the list fails', async () => {
    api.fetchEssayReview.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }))
    const { wrapper: w } = await mountAt(TandaKaranganPage, '/admin-sekolah/tanda-karangan')
    expect(has(w, 'tk-error')).toBe(true)
    expect(has(w, 'tk-card')).toBe(false)
  })

  it('uses the school admin path for the school door and the national path for Admin Pusat', async () => {
    await mountPage([], '/admin-sekolah/tanda-karangan')
    expect(api.fetchEssayReview).toHaveBeenLastCalledWith(false, expect.anything())
    await mountPage([], '/admin/spm/tanda-karangan')
    expect(api.fetchEssayReview).toHaveBeenLastCalledWith(true, expect.anything())
  })
})

describe('Tanda Karangan confirm', () => {
  it('starts at the AI proposal and sends it; success flashes the message and reloads', async () => {
    api.confirmEssayMark.mockResolvedValue({ data: { id: '11', finalMarks: 12 }, status: 'Markah karangan disahkan.' })
    const { wrapper: w } = await mountPage([row()])
    const input = w.get('[data-testid="tk-marks"]')
    expect((input.element as HTMLInputElement).value).toBe('12')
    await w.get('[data-testid="tk-confirm"]').trigger('click')
    await flushPromises()
    expect(api.confirmEssayMark).toHaveBeenCalledWith(false, '11', 12)
    expect(useFlashStore().current).toMatchObject({ type: 'success', message: 'Markah karangan disahkan.' })
    expect(api.fetchEssayReview).toHaveBeenCalledTimes(2)
  })

  it('sends the adjusted mark', async () => {
    api.confirmEssayMark.mockResolvedValue({ data: { id: '11', finalMarks: 15 }, status: 'Markah karangan disahkan.' })
    const { wrapper: w } = await mountPage([row()])
    await w.get('[data-testid="tk-marks"]').setValue('15')
    await w.get('[data-testid="tk-confirm"]').trigger('click')
    await flushPromises()
    expect(api.confirmEssayMark).toHaveBeenCalledWith(false, '11', 15)
  })

  it('an empty field is sent as 0 (as V2)', async () => {
    api.confirmEssayMark.mockResolvedValue({ data: { id: '12', finalMarks: 0 }, status: 'Markah karangan disahkan.' })
    const { wrapper: w } = await mountPage([row({ id: '12', proposed: null })])
    await w.get('[data-testid="tk-confirm"]').trigger('click')
    await flushPromises()
    expect(api.confirmEssayMark).toHaveBeenCalledWith(false, '12', 0)
  })

  it('a refused confirm shows the error and keeps the card', async () => {
    api.confirmEssayMark.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' }))
    const { wrapper: w } = await mountPage([row()])
    await w.get('[data-testid="tk-confirm"]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current).toMatchObject({ type: 'error', message: 'Tidak dijumpai.' })
    expect(w.findAll('[data-testid="tk-card"]')).toHaveLength(1)
    expect(api.fetchEssayReview).toHaveBeenCalledTimes(1)
  })
})

describe('Tanda Karangan routes', () => {
  const at = (path: string) => ({ path, meta: karangan.find((r) => r.path === path)!.meta }) as unknown as RouteLocationNormalized

  it('declares both doors with the right shell and role', () => {
    expect(karangan.map((r) => r.path)).toEqual(['/admin-sekolah/tanda-karangan', '/admin/spm/tanda-karangan'])
    expect(karangan[0]!.meta).toMatchObject({ layout: 'user', roles: ['school_admin'] })
    expect(karangan[1]!.meta).toMatchObject({ layout: 'admin', roles: ['admin'] })
  })

  it('refuses other roles in place and sends a guest to login', () => {
    const school = at('/admin-sekolah/tanda-karangan')
    const as = (role: string | null) => ({ isLoggedIn: role !== null, role, landingPath: '/dashboard' }) as never
    expect(decideAccess(school, as('teacher'))).toEqual({ kind: 'in-place', status: 403 })
    expect(decideAccess(school, as('admin'))).toEqual({ kind: 'in-place', status: 403 })
    expect(decideAccess(school, as('school_admin'))).toEqual({ kind: 'allow' })
    expect(decideAccess(at('/admin/spm/tanda-karangan'), as('admin'))).toEqual({ kind: 'allow' })
    expect(decideAccess(at('/admin/spm/tanda-karangan'), as('school_admin'))).toEqual({ kind: 'in-place', status: 403 })
    expect(decideAccess(school, as(null))).toEqual({ kind: 'redirect', to: '/login' })
  })
})
