// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { AchievementItem, Achievements, Leaderboard, Referral, ShareCards } from '../../api'
import { setCardDownloader } from '../../lib/student/studentb-share'
import AchievementsPage from '../../pages/student-b/AchievementsPage.vue'
import KadKongsiPage from '../../pages/student-b/KadKongsiPage.vue'
import LeaderboardPage from '../../pages/student-b/LeaderboardPage.vue'
import ReferralPage from '../../pages/student-b/ReferralPage.vue'

const api = vi.hoisted(() => ({
  fetchGamificationLeaderboard: vi.fn(),
  fetchGamificationAchievements: vi.fn(),
  fetchShareCards: vi.fn(),
  fetchReferral: vi.fn(),
}))
vi.mock('../../api', () => api)

vi.mock('@/composables/useSession', () => ({
  useSession: () => ({ user: ref({ id: 3, name: 'Pelajar Demo Dua' }) }),
}))

const clip = vi.hoisted(() => ({ writeText: vi.fn() }))
let openSpy: MockInstance<typeof window.open>
let wrapper: VueWrapper | null = null
let router: Router

async function render(component: object, path: string, url = path): Promise<VueWrapper> {
  router = createRouter({ history: createMemoryHistory(), routes: [{ path, component }] })
  await router.push(url)
  wrapper = mount(component, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const tid = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`)

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  clip.writeText.mockReset()
  clip.writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: clip, configurable: true })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  setCardDownloader(null)
  vi.restoreAllMocks()
})

describe('S14 LeaderboardPage', () => {
  const board = (): Leaderboard => ({
    podium: [1, 2, 3].map((rank) => ({
      rank,
      userId: rank,
      name: `Pelajar Demo ${String(rank)}`,
      initials: 'PD',
      totalSyilingEarned: 1_018_083 - rank * 1000,
      tier: { key: 'platinum', labelMs: 'Platinum', icon: '💎' },
    })),
    rows: Array.from({ length: 47 }, (_, i) => ({
      rank: i + 4,
      userId: i + 4,
      name: `Pelajar Demo ${String(i + 4)}`,
      initials: 'PD',
      title: 'Mitos',
      level: 39,
      totalSyilingEarned: 65_129 - i,
      tierIcon: '💎',
    })),
  })

  it('renders the hero, the podium in the order silver-gold-bronze and 47 rows', async () => {
    api.fetchGamificationLeaderboard.mockResolvedValue(board())
    const w = await render(LeaderboardPage, '/gamification/leaderboard')
    expect(w.get('[data-testid=leaderboard-hero]').text()).toContain('🏆 Papan Pendahulu')
    expect(w.text()).toContain('Siapa paling rajin belajar?')
    const cards = tid(w, 'lb-podium-card')
    expect(cards.map((c) => c.attributes('data-rank'))).toEqual(['2', '1', '3'])
    expect(tid(w, 'lb-podium-score').map((e) => e.text())).toEqual([
      '1,016,083 syiling',
      '1,017,083 syiling',
      '1,015,083 syiling',
    ])
    expect(tid(w, 'lb-podium-tier')[0]?.text()).toBe('💎Platinum')
    const rows = tid(w, 'lb-row')
    expect(rows).toHaveLength(47)
    expect(rows[0]?.text()).toContain('4')
    expect(rows[0]?.text()).toContain('Mitos · Level 39')
    expect(rows[0]?.text()).toContain('65,129')
  })

  it('ignores ?period= (the same call, no query)', async () => {
    api.fetchGamificationLeaderboard.mockResolvedValue(board())
    await render(
      LeaderboardPage,
      '/gamification/leaderboard',
      '/gamification/leaderboard?period=week',
    )
    expect(api.fetchGamificationLeaderboard).toHaveBeenCalledTimes(1)
    expect(api.fetchGamificationLeaderboard.mock.calls[0]).toHaveLength(1)
  })

  it('shows the error block and retries', async () => {
    api.fetchGamificationLeaderboard.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    api.fetchGamificationLeaderboard.mockResolvedValueOnce(board())
    const w = await render(LeaderboardPage, '/gamification/leaderboard')
    expect(tid(w, 'leaderboard-error')).toHaveLength(1)
    await w.get('[data-testid=leaderboard-retry]').trigger('click')
    await flushPromises()
    expect(tid(w, 'lb-row')).toHaveLength(47)
  })
})

describe('S15 AchievementsPage', () => {
  const item = (over: Partial<AchievementItem> = {}): AchievementItem => ({
    id: 1,
    icon: '👣',
    name: 'Langkah Pertama',
    description: 'Jawab kuiz pertama anda',
    rarity: 'common',
    rarityLabel: 'Biasa',
    rarityColor: '#9ca3af',
    rewardSyiling: 5,
    rewardXp: 3,
    progress: { value: 0, target: 1 },
    unlocked: false,
    unlockedAt: null,
    ...over,
  })
  const data = (items: AchievementItem[], unlocked = 0): Achievements => ({
    unlocked,
    total: 25,
    streak: { current: 1, best: 5, multiplier: 1 },
    items,
  })

  it('renders the header, the streak card, the pills and locked cards', async () => {
    api.fetchGamificationAchievements.mockResolvedValue(
      data([item(), item({ id: 3, name: 'Streak 3 Hari', icon: '🔥', progress: null })]),
    )
    const w = await render(AchievementsPage, '/gamification/achievements')
    expect(w.get('[data-testid=achievements-subtitle]').text()).toBe(
      'Kumpul lencana dan capai pencapaian — 0/25 dicapai',
    )
    expect(w.get('[data-testid=streak-current]').text()).toBe('1')
    expect(w.get('[data-testid=streak-bonus]').text()).toBe('1.0x Bonus')
    expect(w.get('[data-testid=streak-best]').text()).toBe('Terbaik: 5 hari')
    expect(tid(w, 'achievements-pill').map((p) => p.text())).toEqual([
      'Semua',
      'Biasa',
      'Jarang',
      'Epik',
      'Legenda',
    ])
    expect(tid(w, 'achievements-pill')[0]?.attributes('data-active')).toBe('true')
    const cards = tid(w, 'badge-card')
    expect(cards).toHaveLength(2)
    expect(cards.every((c) => c.attributes('data-locked') === 'true')).toBe(true)
    expect(tid(w, 'badge-reward')[0]?.text()).toBe('🪙 5 · ⭐ 3 XP')
    // progress only on the card that carries it
    expect(tid(w, 'badge-progress')).toHaveLength(1)
    expect(tid(w, 'badge-progress-text')[0]?.text()).toBe('0/1')
    expect(tid(w, 'badge-rarity')[0]?.text()).toBe('Biasa')
  })

  it('passes ?rarity= to the API, marks that pill active, and renders no card for an unknown value', async () => {
    api.fetchGamificationAchievements.mockResolvedValue(data([]))
    const w = await render(
      AchievementsPage,
      '/gamification/achievements',
      '/gamification/achievements?rarity=zzz',
    )
    expect(api.fetchGamificationAchievements.mock.calls[0]?.[0]).toEqual({ rarity: 'zzz' })
    expect(tid(w, 'achievements-pill')).toHaveLength(5)
    expect(tid(w, 'achievements-pill').every((p) => p.attributes('data-active') === 'false')).toBe(
      true,
    )
    expect(tid(w, 'badge-card')).toHaveLength(0)
    expect(w.text()).not.toMatch(/tiada/i)
  })

  it('does not open the modal for a locked card; opens, shares and closes for an unlocked one', async () => {
    const download = vi.fn(() => Promise.resolve())
    setCardDownloader(download)
    api.fetchGamificationAchievements.mockResolvedValue(
      data([item(), item({ id: 2, name: 'Pelajar Rajin', unlocked: true, rewardSyiling: 15 })], 1),
    )
    const w = await render(AchievementsPage, '/gamification/achievements')
    await tid(w, 'badge-card')[0]?.trigger('click')
    expect(tid(w, 'share-modal')).toHaveLength(0)

    await tid(w, 'badge-card')[1]?.trigger('click')
    expect(tid(w, 'share-modal')).toHaveLength(1)
    expect(w.get('[data-testid=share-name]').text()).toBe('Pelajar Rajin')
    expect(w.get('[data-testid=share-user]').text()).toBe('Pelajar Demo Dua')
    expect(w.get('[data-testid=share-syiling]').text()).toContain('15')

    await w.get('[data-testid=share-download]').trigger('click')
    expect(download).toHaveBeenCalledWith(expect.anything(), 'pencapaian-pelajar-rajin.png')

    await w.get('[data-testid=share-whatsapp]').trigger('click')
    const url = String(openSpy.mock.calls[0]?.[0])
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(url)).toContain('"Pelajar Rajin"')
    expect(decodeURIComponent(url)).toContain('https://prestasiplus.my/pelajar/3')

    await w.get('[data-testid=share-close]').trigger('click')
    expect(tid(w, 'share-modal')).toHaveLength(0)

    await tid(w, 'badge-card')[1]?.trigger('click')
    await w.get('[data-testid=share-modal]').trigger('click')
    expect(tid(w, 'share-modal')).toHaveLength(0)
  })

  it('does not close the modal on a click inside the dialog', async () => {
    api.fetchGamificationAchievements.mockResolvedValue(data([item({ unlocked: true })], 1))
    const w = await render(AchievementsPage, '/gamification/achievements')
    await tid(w, 'badge-card')[0]?.trigger('click')
    await w.get('[data-testid=share-dialog]').trigger('click')
    expect(tid(w, 'share-modal')).toHaveLength(1)
  })
})

describe('S16 ReferralPage', () => {
  const referral = (): Referral => ({
    code: '4JURJTT',
    rewardReferrer: 50,
    rewardReferee: 25,
    registerUrl: 'https://prestasiplus.my/register?ref=4JURJTT',
    whatsappUrl:
      'https://wa.me/?text=Jom belajar matematik di PRESTASIPLUS! Guna kod 4JURJTT untuk dapat 25 syiling PERCUMA! https://prestasiplus.my/register?ref=4JURJTT',
    telegramUrl:
      'https://t.me/share/url?url=https://prestasiplus.my/register?ref=4JURJTT&text=Jom belajar matematik di PRESTASIPLUS! Guna kod 4JURJTT',
    stats: { referrals: 0, rewarded: 0, syilingEarned: 0 },
  })

  it('renders the tiles, the code, the links and the statistics', async () => {
    api.fetchReferral.mockResolvedValue(referral())
    const w = await render(ReferralPage, '/gamification/referral')
    expect(w.text()).toContain('🤝 Rujuk Kawan, Dapat Syiling!')
    expect(w.text()).toContain('Jemput kawan anda ke PRESTASIPLUS — dua-dua dapat ganjaran!')
    expect(w.get('[data-testid=reward-you]').text()).toBe('50')
    expect(w.get('[data-testid=reward-friend]').text()).toBe('25')
    expect(w.text()).toContain('Syiling untuk ANDA')
    expect(w.text()).toContain('Syiling untuk KAWAN')
    expect(w.get('[data-testid=referral-code]').text()).toBe('4JURJTT')
    const wa = w.get('[data-testid=referral-whatsapp]')
    expect(wa.attributes('href')).toBe(referral().whatsappUrl)
    expect(wa.attributes('target')).toBe('_blank')
    expect(w.get('[data-testid=referral-telegram]').attributes('href')).toBe(referral().telegramUrl)
    expect(tid(w, 'stat-referrals')[0]?.text()).toContain('0')
    expect(w.get('[data-testid=referral-stats]').text()).toContain('Statistik Rujukan')
    expect(w.get('[data-testid=referral-stats]').text()).toContain('Syiling Diperolehi')
  })

  it('copies the code and the link and changes the labels (they stay)', async () => {
    api.fetchReferral.mockResolvedValue(referral())
    const w = await render(ReferralPage, '/gamification/referral')
    const code = w.get('[data-testid=referral-copy-code]')
    const link = w.get('[data-testid=referral-copy-link]')
    expect(code.text()).toBe('Salin Kod')
    expect(link.text()).toBe('Salin Pautan')
    await code.trigger('click')
    await flushPromises()
    expect(clip.writeText).toHaveBeenLastCalledWith('4JURJTT')
    expect(code.text()).toBe('✓ Disalin!')
    await link.trigger('click')
    await flushPromises()
    expect(clip.writeText).toHaveBeenLastCalledWith('https://prestasiplus.my/register?ref=4JURJTT')
    expect(link.text()).toBe('✓ Pautan Disalin!')
    expect(code.text()).toBe('✓ Disalin!')
  })

  it('still changes the label when the clipboard refuses', async () => {
    api.fetchReferral.mockResolvedValue(referral())
    clip.writeText.mockRejectedValue(new Error('denied'))
    const w = await render(ReferralPage, '/gamification/referral')
    await w.get('[data-testid=referral-copy-code]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid=referral-copy-code]').text()).toBe('✓ Disalin!')
  })
})

describe('S18 KadKongsiPage', () => {
  const cards = (): ShareCards => ({
    name: 'Pelajar Demo Satu',
    initial: 'P',
    profileUrl: 'https://prestasiplus.my/pelajar/1',
    profile: {
      answered: 119,
      accuracy: 38.7,
      sessions: 4,
      tierKey: 'bronze',
      tierIcon: '🥉',
      level: 2,
      currentSyiling: 256,
    },
    kombo: { current: 1, best: 5, multiplier: 1 },
    mastery: [
      { subjectName: 'Bahasa Melayu', level: 2, stage: 'Aktif', accuracy: 48.94, correct: 46 },
      { subjectName: 'Sejarah', level: 1, stage: 'Mula Belajar', accuracy: 35, correct: 14 },
    ],
    ranking: { accuracy: 38.7, correct: 46, answered: 119 },
  })

  const waText = (): string => {
    const url = String(openSpy.mock.calls.at(-1)?.[0])
    return decodeURIComponent(url.replace('https://wa.me/?text=', ''))
  }

  it('shows the four tabs with Profil active and the profile card', async () => {
    api.fetchShareCards.mockResolvedValue(cards())
    const w = await render(KadKongsiPage, '/gamification/kad-kongsi')
    expect(
      tid(w, 'kad-tabs')[0]
        ?.findAll('button')
        .map((b) => b.text()),
    ).toEqual(['Profil', 'Kombo', 'Penguasaan', 'Kedudukan'])
    expect(w.get('[data-testid=kad-tab-profil]').attributes('data-active')).toBe('true')
    expect(w.get('[data-testid=kad-profil-title]').text()).toBe('Kad Profil Pelajar')
    expect(w.get('[data-testid=kad-profil-initial]').text()).toBe('P')
    expect(w.get('[data-testid=kad-profil-answered]').text()).toBe('119')
    expect(w.get('[data-testid=kad-profil-accuracy]').text()).toBe('38.7%')
    expect(w.get('[data-testid=kad-profil-sessions]').text()).toBe('4')
    expect(w.get('[data-testid=kad-profil-tier]').text()).toBe('🥉 Gangsa')
    expect(w.get('[data-testid=kad-profil-level]').text()).toBe('Tahap 2')
    expect(w.get('[data-testid=kad-profil-syiling]').text()).toBe('🪙 256')
    expect(w.text()).toContain('🎓 PRESTASIPLUS.MY')
    // one card set at a time
    expect(tid(w, 'kad-kombo')).toHaveLength(0)
  })

  it('switches to Kombo, Penguasaan and Kedudukan', async () => {
    api.fetchShareCards.mockResolvedValue(cards())
    const w = await render(KadKongsiPage, '/gamification/kad-kongsi')

    await w.get('[data-testid=kad-tab-kombo]').trigger('click')
    expect(w.get('[data-testid=kad-kombo-current]').text()).toBe('1')
    expect(w.get('[data-testid=kad-kombo-best]').text()).toBe('5')
    expect(w.get('[data-testid=kad-kombo-mult]').text()).toBe('1.0x')
    expect(w.text()).toContain('Hari Berturut-turut!')
    expect(tid(w, 'kad-profil')).toHaveLength(0)

    await w.get('[data-testid=kad-tab-penguasaan]').trigger('click')
    expect(tid(w, 'kad-mastery-subject').map((e) => e.text())).toEqual(['Bahasa Melayu', 'Sejarah'])
    expect(tid(w, 'kad-mastery-stage').map((e) => e.text())).toEqual([
      'Tahap 2 — Aktif',
      'Tahap 1 — Mula Belajar',
    ])
    expect(tid(w, 'kad-mastery-accuracy').map((e) => e.text())).toEqual(['48.9%', '35%'])
    expect(tid(w, 'kad-mastery-correct').map((e) => e.text())).toEqual(['46', '14'])
    expect(w.get('[data-testid=kad-penguasaan-0-share]').text()).toBe('Kongsi')

    await w.get('[data-testid=kad-tab-ranking]').trigger('click')
    expect(w.get('[data-testid=kad-ranking-line]').text()).toBe('Ketepatan 38.7% · 46/119 betul')
    expect(w.text()).toContain('Kedudukan Terkini')
  })

  it('opens wa.me with the card text and the viewer profile link on every card', async () => {
    api.fetchShareCards.mockResolvedValue(cards())
    const w = await render(KadKongsiPage, '/gamification/kad-kongsi')
    const link = '\n\nhttps://prestasiplus.my/pelajar/1'

    await w.get('[data-testid=kad-profil-share]').trigger('click')
    expect(waText()).toBe(
      `Lihat profil saya di PRESTASIPLUS! 38.7% ketepatan dengan 119 soalan dijawab.${link}`,
    )
    await w.get('[data-testid=kad-tab-kombo]').trigger('click')
    await w.get('[data-testid=kad-kombo-share]').trigger('click')
    expect(waText()).toBe(
      `🔥 Kombo 1 hari berturut-turut di PRESTASIPLUS! Rekod terbaik: 5 hari. Jom cabaran!${link}`,
    )
    await w.get('[data-testid=kad-tab-penguasaan]').trigger('click')
    await w.get('[data-testid=kad-penguasaan-1-share]').trigger('click')
    expect(waText()).toBe(
      `🧠 Saya sudah capai Level 1 (Mula Belajar) dalam Sejarah di PRESTASIPLUS! Ketepatan 35%. Jom bersaing!${link}`,
    )
    await w.get('[data-testid=kad-tab-ranking]').trigger('click')
    await w.get('[data-testid=kad-kedudukan-share]').trigger('click')
    expect(waText()).toBe(`🏆 Kedudukan saya di PRESTASIPLUS: 38.7%! Jom latih tubi!${link}`)
  })

  it('names the download per card and ignores a second click while one is running', async () => {
    api.fetchShareCards.mockResolvedValue(cards())
    let release: () => void = () => undefined
    const download = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    setCardDownloader(download)
    const w = await render(KadKongsiPage, '/gamification/kad-kongsi')
    const button = w.get('[data-testid=kad-profil-download]')
    await button.trigger('click')
    await button.trigger('click')
    expect(download).toHaveBeenCalledTimes(1)
    expect(download).toHaveBeenCalledWith(expect.anything(), 'prestasiplus-profil.png')
    release()
    await flushPromises()
    await button.trigger('click')
    expect(download).toHaveBeenCalledTimes(2)

    release()
    await flushPromises()
    await w.get('[data-testid=kad-tab-penguasaan]').trigger('click')
    await w.get('[data-testid=kad-penguasaan-1-download]').trigger('click')
    expect(download).toHaveBeenLastCalledWith(expect.anything(), 'prestasiplus-penguasaan-1.png')
  })
})
