// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { PP_AUTH_STORAGE_KEY } from '@/stores/session-types'

import TournamentDetailPage from '../../pages/TournamentDetailPage.vue'
import TournamentListPage from '../../pages/TournamentListPage.vue'
import routes from '../../routes/tournament'

const api = vi.hoisted(() => ({
  fetchTournaments: vi.fn(),
  fetchTournament: vi.fn(),
  fetchBattleLobby: vi.fn(),
}))
vi.mock('../../api', () => api)

let wrapper: VueWrapper | undefined

async function mountPage(component: Component, path: string, routePath: string, props = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, component },
      { path: '/:rest(.*)*', component: { template: '<i />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(component, { props, global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

/** Writes `pp.auth` and starts a fresh pinia: the session store restores from storage on creation. */
function loginAs(role: string): void {
  localStorage.setItem(
    PP_AUTH_STORAGE_KEY,
    JSON.stringify({
      token: 't',
      remember: true,
      expiresAt: '2099-01-01T00:00:00+08:00',
      user: { id: 1, role, landingPath: '/dashboard' },
    }),
  )
  setActivePinia(createPinia())
}

const DETAIL = {
  uuid: 'abc',
  title: 'Contoh Tournament Pendaftaran',
  description: 'Penerangan ringkas',
  status: 'registration',
  educationLevelId: 'spm',
  format: 'hybrid',
  groupsCount: 2,
  questionMode: 'subject',
  subjectId: 3,
  examPaperId: null,
  mixedSubjectIds: [],
  totalQuestions: 40,
  timeWindowMinutes: 60,
  topNScoring: 20,
  minParticipants: 10,
  registrationOpensAt: null,
  registrationClosesAt: null,
  liveMatch: null,
  createdAt: '2026-09-25T15:40:00+08:00',
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.fetchTournaments.mockResolvedValue([])
  api.fetchTournament.mockResolvedValue(DETAIL)
  api.fetchBattleLobby.mockResolvedValue({ subjects: [{ id: 3, name: 'Matematik' }] })
})
afterEach(() => {
  localStorage.clear()
  wrapper?.unmount()
  wrapper = undefined
  setRouteOutcome(null)
})

describe('routes (FR-M16-03..05)', () => {
  it('S23 has the live header and tab title; the detail is `:uuid`; no role restriction', () => {
    const list = routes.find((r) => r.path === '/tournament')
    expect(list?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      title: 'Liga & Tournament',
      header: { title: 'Liga & Tournament', subtitle: 'Senarai tournament antara sekolah' },
    })
    expect(routes.map((r) => r.path)).toEqual(['/tournament', '/tournament/:uuid'])
    for (const r of routes) expect(r.meta?.roles).toBeUndefined()
  })
})

describe('S23 TournamentListPage', () => {
  it('shows the hero and the empty card for the default seed', async () => {
    loginAs('student')
    const w = await mountPage(TournamentListPage, '/tournament', '/tournament')
    expect(w.get('h2').text()).toBe('Liga & Tournament')
    expect(w.text()).toContain(
      'Bertanding antara sekolah dalam format liga, kalah mati, atau hibrid!',
    )
    expect(w.get('[data-testid="tournament-empty"]').text()).toBe(
      'Tiada tournament aktif buat masa ini.',
    )
  })

  it('shows "Cipta Tournament Baru" for the admin only', async () => {
    loginAs('admin')
    let w = await mountPage(TournamentListPage, '/tournament', '/tournament')
    const create = w.get('[data-testid="tournament-create"]')
    expect(create.text()).toBe('Cipta Tournament Baru')
    expect(create.attributes('href')).toBe('/tournament/admin/create')
    w.unmount()

    loginAs('school_admin')
    w = await mountPage(TournamentListPage, '/tournament', '/tournament')
    expect(w.find('[data-testid="tournament-create"]').exists()).toBe(false)
  })

  it('does not link to /liga', async () => {
    loginAs('admin')
    const w = await mountPage(TournamentListPage, '/tournament', '/tournament')
    expect(w.findAll('a').some((a) => a.attributes('href')?.startsWith('/liga'))).toBe(false)
  })

  it('lists one card per tournament with the banner line, linking to the uuid', async () => {
    loginAs('student')
    api.fetchTournaments.mockResolvedValue([
      { uuid: 'u1', title: 'Contoh Tournament Pendaftaran', status: 'registration' },
      { uuid: 'u2', title: 'Contoh Tournament Berlangsung', status: 'ongoing' },
    ])
    const w = await mountPage(TournamentListPage, '/tournament', '/tournament')
    const cards = w.findAll('[data-testid="tournament-card"]')
    expect(cards.map((c) => c.attributes('href'))).toEqual(['/tournament/u1', '/tournament/u2'])
    expect(cards[0]?.text()).toContain('Pendaftaran dibuka')
    expect(cards[1]?.text()).toContain('Sedang berlangsung')
    expect(w.find('[data-testid="tournament-empty"]').exists()).toBe(false)
  })
})

describe('Tournament detail (FR-M16-114, PROVISIONAL)', () => {
  it('renders the title, the banner line and the saved fields with the S24 labels', async () => {
    const w = await mountPage(TournamentDetailPage, '/tournament/abc', '/tournament/:uuid', {
      uuid: 'abc',
    })
    expect(w.get('h1').text()).toBe('Contoh Tournament Pendaftaran')
    expect(w.get('[data-testid="tournament-detail-line"]').text()).toBe('Pendaftaran dibuka')
    const field = (k: string) => w.get(`[data-field="${k}"]`).text()
    expect(field('level')).toContain('SPM (Tingkatan 4 & 5)')
    expect(field('format')).toContain('Hibrid (Liga + Kalah Mati)')
    expect(field('groups')).toContain('2')
    expect(field('source')).toContain('Mengikut Mata Pelajaran')
    expect(field('subject')).toContain('Matematik')
    expect(field('total')).toContain('40')
    expect(field('window')).toContain('60')
    expect(field('opens')).toContain('-')
    expect(api.fetchTournament).toHaveBeenCalledWith('abc', expect.anything())
  })

  it('an unknown uuid raises the in-place 404 outcome', async () => {
    api.fetchTournament.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai' }),
    )
    const w = await mountPage(TournamentDetailPage, '/tournament/zzz', '/tournament/:uuid', {
      uuid: 'zzz',
    })
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-testid="tournament-detail-hero"]').exists()).toBe(false)
  })

  it('another failure shows the load error, not the 404 page', async () => {
    api.fetchTournament.mockRejectedValue(new Error('boom'))
    const w = await mountPage(TournamentDetailPage, '/tournament/abc', '/tournament/:uuid', {
      uuid: 'abc',
    })
    expect(useRouteOutcome().value).toBeNull()
    expect(w.find('[data-testid="m16-load-error"]').exists()).toBe(true)
  })
})
