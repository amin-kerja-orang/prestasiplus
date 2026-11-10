// @vitest-environment jsdom
/** `/admin/gamification/challenges` "Cabaran Harian", read only (V2 challenges.blade.php, D118-3). */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminChallengesPage from '../../pages/admin/AdminChallengesPage.vue'
import routes from '../../routes/admin'
import { challenge, open, tid } from './support'

const api = vi.hoisted(() => ({ fetchAdminChallenges: vi.fn() }))
vi.mock('../../api/admin', () => api)

beforeEach(() => {
  document.body.innerHTML = ''
  api.fetchAdminChallenges
    .mockReset()
    .mockResolvedValue([
      challenge(),
      challenge({ id: '2', title: 'Kilat Matematik', difficulty: 'hard', isActive: false, description: '' }),
    ])
})

describe('AdminChallengesPage', () => {
  it('has the V2 title and subtitle on its route', () => {
    expect(routes.find((r) => r.path === '/admin/gamification/challenges')?.meta).toMatchObject({
      header: { title: '🎯 Cabaran Harian', subtitle: 'Urus cabaran harian untuk pelajar' },
    })
  })

  it('shows "Senarai Cabaran (N)" and the active count', async () => {
    const { w } = await open(AdminChallengesPage, '/admin/gamification/challenges')
    expect(tid(w, 'gam-challenges-title').text()).toBe('Senarai Cabaran (2)')
    expect(tid(w, 'gam-challenges-active').text()).toBe('1 Aktif')
  })

  it('shows each challenge with difficulty, status, type, target and rewards', async () => {
    const { w } = await open(AdminChallengesPage, '/admin/gamification/challenges')
    const one = tid(w, 'gam-challenge-1').text()
    expect(one).toContain('Rajin Berlatih')
    expect(one).toContain('Mudah')
    expect(one).toContain('Aktif')
    expect(one).toContain('Selesaikan 3 kuiz hari ini')
    expect(one).toContain('quiz_count')
    expect(one).toContain('Sasaran: 3')
    expect(one).toContain('+15')
    expect(one).toContain('+10 XP')
    const two = tid(w, 'gam-challenge-2').text()
    expect(two).toContain('Susah')
    expect(tid(w, 'gam-challenge-2-status').text()).toBe('Nyahaktif')
    expect(two).toContain('—')
  })

  it('shows the V2 "N sertai / N siap" line of each challenge', async () => {
    const { w } = await open(AdminChallengesPage, '/admin/gamification/challenges')
    for (const id of ['1', '2']) {
      const line = tid(w, `gam-challenge-${id}-stats`).text()
      expect(line).toContain('5 sertai')
      expect(line).toContain('12 siap')
    }
  })

  it('counts 0 sertai / 0 siap when the endpoint sends no counts (the mock)', async () => {
    api.fetchAdminChallenges.mockResolvedValue([challenge({ enrolled: undefined, completed: undefined })])
    const { w } = await open(AdminChallengesPage, '/admin/gamification/challenges')
    const line = tid(w, 'gam-challenge-1-stats').text()
    expect(line).toContain('0 sertai')
    expect(line).toContain('0 siap')
  })

  it('formats large counts with thousands separators', async () => {
    api.fetchAdminChallenges.mockResolvedValue([challenge({ enrolled: 1234, completed: 20500 })])
    const { w } = await open(AdminChallengesPage, '/admin/gamification/challenges')
    const line = tid(w, 'gam-challenge-1-stats').text()
    expect(line).toContain('1,234 sertai')
    expect(line).toContain('20,500 siap')
  })

  it('is read only: no button or input', async () => {
    const { w } = await open(AdminChallengesPage, '/admin/gamification/challenges')
    expect(w.find('button').exists()).toBe(false)
    expect(w.find('input').exists()).toBe(false)
  })

  it('shows the V2 empty copy', async () => {
    api.fetchAdminChallenges.mockResolvedValue([])
    const { w } = await open(AdminChallengesPage, '/admin/gamification/challenges')
    expect(tid(w, 'gam-challenges-empty').text()).toContain('Tiada cabaran dikonfigurasi lagi.')
    expect(tid(w, 'gam-challenges-title').text()).toBe('Senarai Cabaran (0)')
  })
})
