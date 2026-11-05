// @vitest-environment jsdom
import type { AccountProfileActivity } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { api, ApiError } from '@/api'
import { useSessionStore } from '@/stores/session'

import type { UserMe } from '../../api'
import ProfileAspirationField from '../../pages/ProfileAspirationField.vue'
import ProfileBadgeCollection from '../../pages/ProfileBadgeCollection.vue'
import ProfileKomboCalendar from '../../pages/ProfileKomboCalendar.vue'
import ProfilePage from '../../pages/ProfilePage.vue'
import ProfilePublicCard from '../../pages/ProfilePublicCard.vue'
import ProfileRecentSessions from '../../pages/ProfileRecentSessions.vue'
import ProfileStatTiles from '../../pages/ProfileStatTiles.vue'

type Tiles = AccountProfileActivity['tiles']
type Day = AccountProfileActivity['calendar30d'][number]
type Session = AccountProfileActivity['recentSessions'][number]

const TILES: Tiles = { coins: 120, streakDays: 3, level: 2, practiceDays: 5, sessions: 9, accuracy: 66.5, streakBest: 7, streakToday: 3 }

const day = (i: number, sessions: number): Day => ({
  date: `2026-10-${String(i + 1).padStart(2, '0')}`,
  answered: sessions * 10,
  sessions,
})

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  mode: 'past_year',
  modeLabel: 'Tahun Lepas',
  questions: 40,
  correct: 28,
  accuracy: 70,
  coins: 12,
  at: '2026-10-19T09:00:00+08:00',
  ...over,
})

const ACTIVITY: AccountProfileActivity = {
  tiles: TILES,
  calendar30d: Array.from({ length: 30 }, (_, i) => day(i, i === 29 ? 2 : 0)),
  badges: [
    { code: '1', name: 'Langkah Pertama', unlocked: true, earnedAt: '2026-10-05T10:00:00+08:00' },
    { code: '2', name: 'Rajin Berlatih', unlocked: false, earnedAt: null },
  ],
  recentSessions: [session()],
  publicProfilePath: '/pelajar/2',
}

const USER: UserMe = {
  id: 2,
  name: 'Pelajar Demo',
  email: 'pelajar@demo.test',
  phone: null,
  role: 'student',
  grade: 10,
  schoolId: null,
  bio: 'Suka belajar',
  avatarUrl: null,
  createdAt: '2026-02-06T09:00:00+08:00',
  updatedAt: '2026-02-06T09:00:00+08:00',
  lastLoginAt: null,
  school: null,
  landingPath: '/dashboard',
}

let wrapper: VueWrapper | null = null
const track = <T extends VueWrapper>(w: T): T => {
  wrapper = w
  return w
}

const router = () =>
  createRouter({ history: createMemoryHistory(), routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }] })

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ProfilePublicCard (FR-MUR-A1-4)', () => {
  const URL_TEXT = 'https://prestasiplus.test/pelajar/2'
  const mountCard = () => track(mount(ProfilePublicCard, { props: { url: URL_TEXT }, global: { plugins: [router()] } }))

  it('shows the copy, the URL and an open-in-new-tab button', () => {
    const w = mountCard()
    expect(w.text()).toContain('Profil Awam Saya')
    expect(w.text()).toContain('Kongsi profil anda dengan kawan-kawan!')
    expect((w.get('[data-testid=profile-public-url]').element as HTMLInputElement).value).toBe(URL_TEXT)
    expect(w.get('[data-testid=profile-copy]').text()).toBe('Salin')
    expect(w.get('[data-testid=profile-open-public]').attributes('target')).toBe('_blank')
  })

  it('"Salin" copies the URL, reads "Disalin!" for 2 s, then "Salin" again', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = mountCard()
    await w.get('[data-testid=profile-copy]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(URL_TEXT)
    expect(w.get('[data-testid=profile-copy]').text()).toBe('Disalin!')
    vi.advanceTimersByTime(1999)
    await flushPromises()
    expect(w.get('[data-testid=profile-copy]').text()).toBe('Disalin!')
    vi.advanceTimersByTime(2)
    await flushPromises()
    expect(w.get('[data-testid=profile-copy]').text()).toBe('Salin')
    expect(w.find('[data-testid=profile-copy-manual]').exists()).toBe(false)
  })

  it('with the clipboard blocked it selects the URL and shows "Salin pautan secara manual."', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) }, configurable: true })
    const select = vi.spyOn(HTMLInputElement.prototype, 'select')
    const w = track(mount(ProfilePublicCard, { props: { url: URL_TEXT }, attachTo: document.body, global: { plugins: [router()] } }))
    await w.get('[data-testid=profile-copy]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid=profile-copy-manual]').text()).toBe('Salin pautan secara manual.')
    expect(w.get('[data-testid=profile-copy]').text()).toBe('Salin')
    expect(select).toHaveBeenCalled()
  })
})

describe('ProfileStatTiles (FR-MUR-A1-1)', () => {
  const labels = (w: VueWrapper) => w.findAll('[data-testid=profile-tile-label]').map((l) => l.text())
  const values = (w: VueWrapper) => w.findAll('[data-testid=profile-tile-value]').map((l) => l.text())

  it('main: six tiles in order, accuracy as a whole number rounded half up with %', () => {
    const w = track(mount(ProfileStatTiles, { props: { tiles: TILES, kind: 'main' } }))
    expect(labels(w)).toEqual(['Koin Saya', 'Streak Hari', 'Level', 'Hari Berlatih', 'Sesi Latihan', 'Ketepatan'])
    expect(values(w)).toEqual(['120', '3', '2', '5', '9', '67%'])
  })

  it('main: no answers (null accuracy) reads 0%', () => {
    const w = track(mount(ProfileStatTiles, { props: { tiles: { ...TILES, accuracy: null }, kind: 'main' } }))
    expect(values(w).at(-1)).toBe('0%')
  })

  it('main: two columns on a phone', () => {
    const w = track(mount(ProfileStatTiles, { props: { tiles: TILES, kind: 'main' } }))
    expect(w.get('[data-testid=profile-tiles-main]').classes()).toContain('grid-cols-2')
  })

  it('combo: "Kombo Hari Ini", "Rekod Terpanjang", "Hari Berlatih"', () => {
    const w = track(mount(ProfileStatTiles, { props: { tiles: TILES, kind: 'combo' } }))
    expect(labels(w)).toEqual(['Kombo Hari Ini', 'Rekod Terpanjang', 'Hari Berlatih'])
    expect(values(w)).toEqual(['3', '7', '5'])
  })
})

describe('ProfileBadgeCollection (FR-MUR-A1-1, decision 4)', () => {
  it('counts the unlocked badges and greys the locked ones', () => {
    const w = track(mount(ProfileBadgeCollection, { props: { badges: ACTIVITY.badges }, global: { plugins: [router()] } }))
    expect(w.text()).toContain('Koleksi Lencana')
    expect(w.get('[data-testid=profile-badges-count]').text()).toBe('1 lencana telah dikumpul')
    const badges = w.findAll('[data-testid=profile-badge]')
    expect(badges).toHaveLength(2)
    expect(badges[0]?.attributes('data-locked')).toBe('false')
    expect(badges[1]?.attributes('data-locked')).toBe('true')
    // The tile greys the locked badge and says "Terkunci".
    expect(badges[1]?.find('[data-ds=badge-tile]').attributes('data-state')).toBe('locked')
    expect(badges[0]?.find('[data-ds=badge-tile]').attributes('data-state')).toBe('earned')
    expect(badges[1]?.text()).toContain('Terkunci')
    expect(w.find('[data-testid=profile-badges-empty]').exists()).toBe(false)
  })

  it('with 0 unlocked shows the empty text and "Mula Latih Tubi" to /practice, locked badges stay visible', () => {
    const locked = ACTIVITY.badges.map((b) => ({ ...b, unlocked: false, earnedAt: null }))
    const w = track(mount(ProfileBadgeCollection, { props: { badges: locked }, global: { plugins: [router()] } }))
    expect(w.get('[data-testid=profile-badges-count]').text()).toBe('0 lencana telah dikumpul')
    expect(w.get('[data-testid=profile-badges-empty]').text()).toContain('Belum ada lencana lagi')
    expect(w.text()).toContain('Teruskan berlatih untuk dapatkan lencana pertama anda!')
    const start = w.get('[data-testid=profile-badges-start]')
    expect(start.text()).toBe('Mula Latih Tubi')
    expect(start.attributes('href')).toBe('/practice')
    expect(w.findAll('[data-testid=profile-badge]')).toHaveLength(2)
  })

  it('with no badge configured shows only the empty state', () => {
    const w = track(mount(ProfileBadgeCollection, { props: { badges: [] }, global: { plugins: [router()] } }))
    expect(w.find('[data-testid=profile-badges-empty]').exists()).toBe(true)
    expect(w.findAll('[data-testid=profile-badge]')).toHaveLength(0)
  })
})

describe('ProfileKomboCalendar (FR-MUR-A1-1, decision 4)', () => {
  const shade = (w: VueWrapper, i: number) => (w.findAll('[data-testid=profile-calendar-cell]')[i]?.element as HTMLElement).style.backgroundColor

  it('has the copy, 30 cells with the two-digit day, and the note', () => {
    const days = Array.from({ length: 30 }, (_, i) => day(i, 0))
    const w = track(mount(ProfileKomboCalendar, { props: { days } }))
    expect(w.text()).toContain('Kalendar Kombo (30 Hari Terakhir)')
    expect(w.text()).toContain('Jejak latihan harian anda')
    expect(w.text()).toContain('Petak lebih gelap bermaksud lebih banyak sesi pada hari itu.')
    const cells = w.findAll('[data-testid=profile-calendar-cell]')
    expect(cells).toHaveLength(30)
    expect(cells[0]?.text()).toBe('01')
    expect(cells[29]?.text()).toBe('30')
  })

  it('shades by SESSIONS: 0 #f1f5f9, 1 #bbf7d0, 2-3 #4ade80, 4+ #15803d', () => {
    const counts = [0, 1, 2, 3, 4, 9]
    const days = counts.map((n, i) => ({ ...day(i, n), answered: 0 }))
    const w = track(mount(ProfileKomboCalendar, { props: { days } }))
    // Shading follows `sessions`, never `answered` (all 0 here).
    expect(counts.map((_, i) => shade(w, i))).toEqual([
      'rgb(241, 245, 249)',
      'rgb(187, 247, 208)',
      'rgb(74, 222, 128)',
      'rgb(74, 222, 128)',
      'rgb(21, 128, 61)',
      'rgb(21, 128, 61)',
    ])
  })

  it('cell title is "{j M Y} — Tidak berlatih" or "{j M Y} — {n} sesi"', () => {
    const w = track(mount(ProfileKomboCalendar, { props: { days: [day(0, 0), day(8, 3)] } }))
    const cells = w.findAll('[data-testid=profile-calendar-cell]')
    expect(cells[0]?.attributes('title')).toBe('1 Okt 2026 — Tidak berlatih')
    expect(cells[1]?.attributes('title')).toBe('9 Okt 2026 — 3 sesi')
  })
})

describe('ProfileRecentSessions (FR-MUR-A1-6)', () => {
  it('lists the sessions with BM mode names, the columns and the count line', () => {
    const rows = [session(), session({ id: 's2', modeLabel: 'Latih Tubi', accuracy: 55.4, correct: 5, questions: 9, coins: 3 })]
    const w = track(mount(ProfileRecentSessions, { props: { sessions: rows } }))
    expect(w.text()).toContain('Sesi Terkini')
    expect(w.get('[data-testid=profile-sessions-count]').text()).toBe('2 latihan terakhir anda')
    expect(w.findAll('th').map((h) => h.text())).toEqual(['Mod', 'Soalan', 'Betul', 'Ketepatan', 'Koin', 'Tarikh'])
    expect(w.findAll('[data-testid=profile-session-mode]').map((m) => m.text())).toEqual(['Tahun Lepas', 'Latih Tubi'])
    expect(w.findAll('tbody tr')[0]?.text()).toContain('19 Okt 2026')
    expect(w.find('[data-testid=profile-sessions-scroll]').exists()).toBe(true)
  })

  it('accuracy pill: whole number, green at 70+, amber 50-69, red below 50', () => {
    const rows = [
      session({ id: 'a', accuracy: 69.5 }),
      session({ id: 'b', accuracy: 70 }),
      session({ id: 'c', accuracy: 50 }),
      session({ id: 'd', accuracy: 49.4 }),
      session({ id: 'e', accuracy: null, questions: 0, correct: 0 }),
    ]
    const w = track(mount(ProfileRecentSessions, { props: { sessions: rows } }))
    const pills = w.findAll('[data-testid=profile-session-accuracy]')
    expect(pills.map((p) => p.text())).toEqual(['70%', '70%', '50%', '49%', '0%'])
    // 69.5 rounds half up to 70, so it is green; 49.4 is red.
    expect(pills.map((p) => p.classes().some((c) => c.includes('success')))).toEqual([true, true, false, false, false])
    expect(pills.map((p) => p.classes().some((c) => c.includes('warning')))).toEqual([false, false, true, false, false])
    expect(pills.map((p) => p.classes().some((c) => c.includes('error')))).toEqual([false, false, false, true, true])
  })

  it('empty state', () => {
    const w = track(mount(ProfileRecentSessions, { props: { sessions: [] } }))
    expect(w.get('[data-testid=profile-sessions-empty]').text()).toContain('Belum ada sesi latihan lagi')
    expect(w.text()).toContain('Teruskan berlatih untuk melihat rekod anda di sini!')
    expect(w.find('table').exists()).toBe(false)
  })
})

describe('ProfileAspirationField (FR-MUR-A1-10)', () => {
  it('has the label and placeholder and refuses over 255 characters with the BM text', async () => {
    const w = track(mount(ProfileAspirationField, { props: { modelValue: 'Doktor' } }))
    expect(w.text()).toContain('Cita-Cita Saya')
    expect(w.get('input').attributes('placeholder')).toBe('cth: Doktor, Jurutera, Saintis Data...')
    expect(w.text()).not.toContain('Cita-cita tidak boleh melebihi 255 aksara.')
    await w.setProps({ modelValue: 'x'.repeat(256) })
    expect(w.text()).toContain('Cita-cita tidak boleh melebihi 255 aksara.')
  })
})

describe('ProfilePage, pupil (FR-MUR-A1-1, 3)', () => {
  async function render(user: UserMe = USER): Promise<VueWrapper> {
    const pinia = createPinia()
    setActivePinia(pinia)
    const s = useSessionStore()
    s.setSession({ token: 't', remember: false, expiresAt: '2099-01-01T00:00:00+08:00', user })
    vi.spyOn(s, 'refreshUser').mockResolvedValue(null)
    const w = track(mount(ProfilePage, { global: { plugins: [pinia, router()] } }))
    await flushPromises()
    return w
  }

  it('shows the blocks in the PRD order', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(ACTIVITY)
    const w = await render()
    const order = [
      'profile-hero',
      'profile-public-card',
      'profile-tiles-main',
      'profile-form-card',
      'profile-tiles-combo',
      'profile-badges',
      'profile-calendar',
      'profile-sessions',
    ]
    const html = w.html()
    const at = order.map((id) => html.indexOf(`data-testid="${id}"`))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(getSpy).toHaveBeenCalledWith('/api/me/profile-activity')
    expect((w.get('[data-testid=profile-public-url]').element as HTMLInputElement).value).toBe(`${window.location.origin}/pelajar/2`)
  })

  it('the form: "Kemaskini Profil", "Bio Saya", counter {n}/1000 and the button "Simpan"', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ACTIVITY)
    const w = await render()
    const form = w.get('[data-testid=profile-form-card]')
    expect(form.text()).toContain('Kemaskini Profil')
    expect(form.text()).toContain('Ceritakan tentang diri dan cita-cita anda')
    expect(form.text()).toContain('Bio Saya')
    const input = w.get('[data-testid=profile-bio-input]')
    expect(input.attributes('placeholder')).toBe('Tulis sedikit tentang diri anda...')
    expect((input.element as HTMLTextAreaElement).value).toBe('Suka belajar')
    expect(w.get('[data-testid=profile-bio-counter]').text()).toBe('12/1000')
    expect(w.get('[data-testid=profile-save]').text()).toBe('Simpan')
  })

  it('"Simpan" sends PUT /api/me with the bio and the aspiration and shows the success line', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ACTIVITY)
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { ...USER, bio: 'Saya suka Sains' }, status: 'Profil berjaya dikemaskini.' })
    const w = await render()
    await w.get('[data-testid=profile-bio-input]').setValue('Saya suka Sains')
    await w.get('[data-testid=profile-bio-form]').trigger('submit')
    await flushPromises()
    expect(put).toHaveBeenCalledWith('/api/me', { body: { bio: 'Saya suka Sains', aspiration: null }, raw: true })
    expect(w.get('[data-testid=profile-form-saved]').text()).toBe('Profil berjaya dikemaskini.')
    expect(useSessionStore().user?.bio).toBe('Saya suka Sains')
  })

  it('"Cita-Cita Saya" shows under "Kemaskini Profil", is filled from the user and is sent with the bio (DM-80)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ACTIVITY)
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { ...USER, bio: 'Suka belajar', aspiration: 'Jurutera' }, status: 'ok' })
    const w = await render({ ...USER, aspiration: 'Doktor' })
    const form = w.get('[data-testid=profile-form-card]')
    expect(form.text()).toContain('Cita-Cita Saya')
    const input = w.get('[data-testid=profile-aspiration-input]')
    expect((input.element as HTMLInputElement).value).toBe('Doktor')
    await input.setValue('  Jurutera ')
    await w.get('[data-testid=profile-bio-form]').trigger('submit')
    await flushPromises()
    expect(put).toHaveBeenCalledWith('/api/me', { body: { bio: 'Suka belajar', aspiration: 'Jurutera' }, raw: true })
    expect(useSessionStore().user?.aspiration).toBe('Jurutera')
  })

  it('256 characters of aspiration: the BM error shows and nothing is sent', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ACTIVITY)
    const put = vi.spyOn(api, 'put')
    const w = await render()
    await w.get('[data-testid=profile-aspiration-input]').setValue('x'.repeat(256))
    await w.get('[data-testid=profile-bio-form]').trigger('submit')
    await flushPromises()
    expect(put).not.toHaveBeenCalled()
    expect(w.get('[data-testid=profile-form-error]').text()).toBe('Cita-cita tidak boleh melebihi 255 aksara.')
  })

  it('a blank bio clears it (null)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ACTIVITY)
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { ...USER, bio: null }, status: 'ok' })
    const w = await render()
    await w.get('[data-testid=profile-bio-input]').setValue('   ')
    await w.get('[data-testid=profile-bio-form]').trigger('submit')
    await flushPromises()
    expect(put).toHaveBeenCalledWith('/api/me', { body: { bio: null, aspiration: null }, raw: true })
  })

  it('1001 characters: the BM error shows, nothing is sent and the typed text stays (AC-MUR-A1-8)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ACTIVITY)
    const put = vi.spyOn(api, 'put')
    const w = await render()
    const long = 'a'.repeat(1001)
    await w.get('[data-testid=profile-bio-input]').setValue(long)
    expect(w.get('[data-testid=profile-bio-counter]').text()).toBe('1001/1000')
    await w.get('[data-testid=profile-bio-form]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=profile-form-error]').text()).toBe('Bio tidak boleh melebihi 1000 aksara.')
    expect(put).not.toHaveBeenCalled()
    expect((w.get('[data-testid=profile-bio-input]').element as HTMLTextAreaElement).value).toBe(long)
  })

  it('a server failure keeps the typed text and shows the server text', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ACTIVITY)
    vi.spyOn(api, 'put').mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Bio tidak sah.', fields: { bio: 'Bio tidak sah.' } }),
    )
    const w = await render()
    await w.get('[data-testid=profile-bio-input]').setValue('Teks saya')
    await w.get('[data-testid=profile-bio-form]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=profile-form-error]').text()).toBe('Bio tidak sah.')
    expect((w.get('[data-testid=profile-bio-input]').element as HTMLTextAreaElement).value).toBe('Teks saya')
    expect(w.find('[data-testid=profile-form-saved]').exists()).toBe(false)
  })

  it('a failed load shows an error panel with "Cuba Lagi" that reloads', async () => {
    const get = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('boom')).mockResolvedValue(ACTIVITY)
    const w = await render()
    expect(w.find('[data-testid=profile-activity-error]').exists()).toBe(true)
    expect(w.find('[data-testid=profile-public-card]').exists()).toBe(false)
    await w.get('[data-testid=profile-activity-error] button').trigger('click')
    await flushPromises()
    expect(get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid=profile-public-card]').exists()).toBe(true)
  })
})
