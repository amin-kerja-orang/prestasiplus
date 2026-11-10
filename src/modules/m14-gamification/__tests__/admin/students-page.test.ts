// @vitest-environment jsdom
/** `/admin/gamification/students` "Pelajar Gamifikasi" (V2 students.blade.php). */
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminStudentsPage from '../../pages/admin/AdminStudentsPage.vue'
import routes from '../../routes/admin'
import { listOf, open, studentRow, TIERS, tid } from './support'

const api = vi.hoisted(() => ({ fetchAdminStudents: vi.fn(), fetchAdminTiers: vi.fn() }))
vi.mock('../../api/admin', () => api)

beforeEach(() => {
  document.body.innerHTML = ''
  api.fetchAdminTiers.mockReset().mockResolvedValue(TIERS)
  api.fetchAdminStudents
    .mockReset()
    .mockResolvedValue(
      listOf([studentRow(), studentRow({ userId: 2, name: 'Murid Demo Maju', tierKey: 'silver' })]),
    )
})

describe('AdminStudentsPage', () => {
  it('has the V2 title and subtitle on its route', () => {
    expect(routes.find((r) => r.path === '/admin/gamification/students')?.meta).toMatchObject({
      header: { title: '👥 Pelajar Gamifikasi', subtitle: 'Pantau progress pelajar & baki syiling / token' },
    })
  })

  it('shows the V2 columns and a row per pupil', async () => {
    const { w } = await open(AdminStudentsPage, '/admin/gamification/students')
    const head = w.findAll('th').map((th) => th.text())
    expect(head).toEqual(['Pelajar', 'Tier', 'Level', 'Baki Syiling', 'Token', 'Jumlah Syiling', 'XP'])
    const text = tid(w, 'gam-students-table').text()
    expect(text).toContain('Murid Demo Maju')
    expect(text).toContain('pelajar@demo.test · ID: 1')
    expect(text).toContain('🥈 Perak')
    expect(text).toContain('1,386')
  })

  it('fetches page 1 with no filter first', async () => {
    await open(AdminStudentsPage, '/admin/gamification/students')
    expect(api.fetchAdminStudents).toHaveBeenCalledWith(
      expect.objectContaining({ tier: '', search: '', page: 1 }),
    )
  })

  it('offers "Semua Tier" and one option per tier', async () => {
    const { w } = await open(AdminStudentsPage, '/admin/gamification/students')
    const options = tid(w, 'gam-students-tier')
      .findAll('option')
      .map((o) => o.text())
    expect(options).toEqual(['Semua Tier', '🥉 Gangsa', '🥈 Perak'])
  })

  it('puts the search and tier into the query string on Cari and fetches with them', async () => {
    const { w, router } = await open(AdminStudentsPage, '/admin/gamification/students')
    await w.get('input[name="q"]').setValue('maju')
    await tid(w, 'gam-students-tier').setValue('silver')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ tier: 'silver', q: 'maju' })
    expect(api.fetchAdminStudents).toHaveBeenLastCalledWith(
      expect.objectContaining({ tier: 'silver', search: 'maju' }),
    )
  })

  it('opens on the filter of the query string and shows its chips', async () => {
    const { w } = await open(AdminStudentsPage, '/admin/gamification/students?tier=bronze&q=demo')
    expect(api.fetchAdminStudents).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'bronze', search: 'demo' }),
    )
    expect(w.text()).toContain('🥉 Gangsa')
  })

  it('shows the V2 empty copy', async () => {
    api.fetchAdminStudents.mockResolvedValue(listOf([]))
    const { w } = await open(AdminStudentsPage, '/admin/gamification/students')
    expect(w.text()).toContain('Tiada pelajar sepadan.')
  })

  it('shows an error when the list cannot be loaded', async () => {
    api.fetchAdminStudents.mockRejectedValueOnce(new Error('x'))
    const { w } = await open(AdminStudentsPage, '/admin/gamification/students')
    expect(w.text()).toContain('Tidak dapat memuatkan data. Sila cuba semula.')
  })
})
