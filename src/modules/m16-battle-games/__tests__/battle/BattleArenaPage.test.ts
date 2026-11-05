// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ArenaView } from '../../api'
import { confirmHost, confirmState, settleConfirm } from '@/ds/useConfirm'
import { useBattleSearch } from '../../composables/useBattleSearch'
import BattleArenaPage from '../../pages/BattleArenaPage.vue'

const api = vi.hoisted(() => ({
  fetchArena: vi.fn(),
  answerArena: vi.fn(),
  forfeitBattle: vi.fn(),
  startBattle: vi.fn(),
}))
vi.mock('../../api/battle', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  ...api,
}))

const view = (): ArenaView => ({
  uuid: 'u1',
  status: 'active',
  you: 'A',
  players: { A: { name: 'Aina', school: 'SK A' }, B: { name: 'Bot', school: 'SK B' } },
  scores: { A: 0, B: 0 },
  index: 1,
  total: 10,
  question: {
    id: 1,
    text: 'Soalan?',
    options: [
      { id: 1, label: 'A', text: 'Satu' },
      { id: 2, label: 'B', text: 'Dua' },
    ],
  },
  secondsLeft: 15,
})

let wrapper: VueWrapper | undefined

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('arena answer failure', () => {
  it('shows the error after the reload and unlocks the options', async () => {
    api.fetchArena.mockResolvedValue(view())
    api.answerArena.mockRejectedValue(new Error('boom'))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/battle/arena/:uuid', component: { template: '<div />' } }],
    })
    await router.push('/battle/arena/u1')
    await router.isReady()
    wrapper = mount(BattleArenaPage, { attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()

    await wrapper.findAll('[data-testid="battle-arena-option"]')[0]!.trigger('click')
    await flushPromises()

    expect(api.fetchArena).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Maaf, berlaku ralat')
    const first = wrapper.find('[data-testid="battle-arena-option"]')
    expect(first.attributes('disabled')).toBeUndefined()
  })
})

// --- S7-T01 part C: shared rounds, the reveal, the waiting state and the finished states -----------

const T0 = new Date('2026-09-25T08:00:00Z').getTime()
const iso = (ms: number): string => new Date(ms).toISOString()

const OPTIONS = [
  { id: 0, label: 'A', text: 'Satu' },
  { id: 1, label: 'B', text: 'Dua' },
  { id: 2, label: 'C', text: 'Tiga' },
  { id: 3, label: 'D', text: 'Empat' },
]
const question = (id: number) => ({ id, text: `Soalan ${String(id)}?`, options: OPTIONS })

/** An answering view; `secondsLeft` counts N only, `roundEndsAt` adds the 3 s grace. */
const answering = (over: Partial<ArenaView> = {}): ArenaView => ({
  ...view(),
  question: question(11),
  total: 15,
  phase: 'answering',
  secondsLeft: 15,
  roundEndsAt: iso(T0 + 18_000),
  youAnswered: false,
  ...over,
})

const revealView = (over: Partial<ArenaView> = {}): ArenaView => ({
  ...answering(),
  phase: 'reveal',
  secondsLeft: 0,
  roundEndsAt: iso(T0 + 3_000),
  youAnswered: true,
  scores: { A: 867, B: 500 },
  reveal: {
    index: 1,
    correctOptionId: 1,
    you: { optionId: 1, correct: true, points: 867 },
    opponent: { optionId: 2, correct: false, points: 0 },
  },
  ...over,
})

const finished = (
  status: ArenaView['status'],
  winner: 'A' | 'B' | null,
  scoreA = 1200,
  scoreB = 900,
  over: Partial<ArenaView> = {},
): ArenaView => ({
  ...view(),
  status,
  question: null,
  secondsLeft: 0,
  phase: 'finished',
  total: 10,
  result: { winner, scoreA, scoreB },
  ...over,
})

async function mountArena(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/battle/arena/:uuid', component: { template: '<div />' } }],
  })
  await router.push('/battle/arena/u1')
  await router.isReady()
  wrapper = mount(BattleArenaPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (id: string) => wrapper!.find(`[data-testid="${id}"]`)
const options = () => wrapper!.findAll('[data-testid="battle-arena-option"]')
const states = () => options().map((o) => o.attributes('data-state'))

describe('arena rounds (S7-T01 part C)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(T0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('answering: the question with the real total, four enabled options and the countdown from secondsLeft', async () => {
    api.fetchArena.mockResolvedValue(answering({ index: 3, total: 20, secondsLeft: 9 }))
    await mountArena()
    expect(t('battle-arena-progress').text()).toBe('Soalan 3/20')
    expect(t('battle-arena-text').text()).toBe('Soalan 11?')
    expect(options()).toHaveLength(4)
    expect(states()).toEqual(['idle', 'idle', 'idle', 'idle'])
    expect(t('battle-arena-seconds').text()).toBe('9s')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(t('battle-arena-seconds').text()).toBe('7s')
    expect(t('battle-arena-waiting').exists()).toBe(false)
    expect(t('battle-arena-feedback').exists()).toBe(false)
  })

  it('each answer button is a 60 px (>= 44 px) target and the page has no fixed-width row (AC-GM-01.11)', async () => {
    api.fetchArena.mockResolvedValue(answering())
    await mountArena()
    for (const o of options()) {
      expect(o.classes()).toContain('min-h-15') // 60 px
      expect(o.classes()).toContain('w-full') // block: never wider than the 375 px column
    }
    expect(t('battle-arena-forfeit').classes()).toContain('min-h-12')
  })

  it('the grace is invisible: at 0 s the options stay enabled and nothing is sent until the server moves on', async () => {
    api.fetchArena.mockResolvedValue(answering({ secondsLeft: 2 }))
    await mountArena()
    await vi.advanceTimersByTimeAsync(2_500)
    expect(t('battle-arena-seconds').text()).toBe('0s')
    expect(states()).toEqual(['idle', 'idle', 'idle', 'idle'])
    expect(api.answerArena).not.toHaveBeenCalled()
    // answering inside the grace is still possible
    api.answerArena.mockResolvedValue({ accepted: true, phase: 'answering' })
    await options()[1]!.trigger('click')
    await flushPromises()
    expect(api.answerArena).toHaveBeenCalledTimes(1)
  })

  it('an answer posts the question, option and whole seconds used; the page shows waiting, never correctness', async () => {
    // the view says youAnswered only once the answer is stored; the opponent has not answered yet
    let stored = false
    api.fetchArena.mockImplementation(() =>
      Promise.resolve(
        answering({ youAnswered: stored, secondsLeft: 15 - Math.floor((Date.now() - T0) / 1000) }),
      ),
    )
    api.answerArena.mockImplementation(() => {
      stored = true
      return Promise.resolve({ accepted: true, phase: 'answering', correct: true, correctOptionId: 1 })
    })
    // a legacy server would add the key here: the page must not show it (ruling 45)
    await mountArena()
    await vi.advanceTimersByTimeAsync(4_000)
    await options()[1]!.trigger('click')
    await flushPromises()
    expect(api.answerArena).toHaveBeenCalledExactlyOnceWith('u1', {
      questionId: 11,
      optionId: 1,
      seconds: 4,
    })
    expect(t('battle-arena-waiting').exists()).toBe(true)
    expect(t('battle-arena-waiting').text()).toBe('Menunggu lawan...')
    expect(states()).toEqual(['dimmed', 'selected', 'dimmed', 'dimmed'])
    expect(t('battle-arena-feedback').exists()).toBe(false)
    expect(wrapper!.find('[data-state="correct"]').exists()).toBe(false)
    expect(wrapper!.find('[data-state="wrong"]').exists()).toBe(false)
    // a second click on the waiting question sends nothing
    await options()[2]!.trigger('click')
    expect(api.answerArena).toHaveBeenCalledTimes(1)
  })

  it('youAnswered on load (a refresh after answering) shows the waiting state, not an open question', async () => {
    api.fetchArena.mockResolvedValue(answering({ youAnswered: true, secondsLeft: 6 }))
    await mountArena()
    expect(t('battle-arena-waiting').text()).toBe('Menunggu lawan...')
    expect(states()).toEqual(['dimmed', 'dimmed', 'dimmed', 'dimmed'])
    await options()[0]!.trigger('click')
    expect(api.answerArena).not.toHaveBeenCalled()
  })

  it('reveal: the key, both sides and the points from the view; no countdown; correct and wrong marked', async () => {
    api.fetchArena.mockResolvedValue(
      revealView({
        scores: { A: 0, B: 500 },
        reveal: {
          index: 1,
          correctOptionId: 1,
          you: { optionId: 3, correct: false, points: 0 },
          opponent: { optionId: 1, correct: true, points: 500 },
        },
      }),
    )
    await mountArena()
    expect(states()).toEqual(['dimmed', 'correct', 'dimmed', 'wrong'])
    expect(t('battle-arena-feedback').text()).toContain('+0')
    expect(t('battle-arena-opponent').text()).toBe('Lawan: betul +500')
    expect(t('battle-arena-score-B').text()).toBe('500')
    expect(t('battle-arena-seconds').exists()).toBe(false)
    expect(t('battle-arena-waiting').exists()).toBe(false)
    expect(t('battle-arena-progress').text()).toBe('Soalan 1/15')
  })

  it('reveal of a correct own answer shows the points gained', async () => {
    api.fetchArena.mockResolvedValue(revealView())
    await mountArena()
    expect(states()).toEqual(['dimmed', 'correct', 'dimmed', 'dimmed'])
    expect(t('battle-arena-feedback').text()).toContain('+867')
    expect(t('battle-arena-opponent').text()).toBe('Lawan: salah +0')
  })

  it('the next round is read at the reveal roundEndsAt (not a constant) and replaces the screen', async () => {
    // a 5 s reveal: the page waits for the view's roundEndsAt, not for a fixed 1.2 s or 3 s
    api.fetchArena.mockResolvedValueOnce(revealView({ roundEndsAt: iso(T0 + 5_000) }))
    api.fetchArena.mockResolvedValue(
      answering({ index: 2, question: question(12), roundEndsAt: iso(T0 + 5_000 + 18_000) }),
    )
    await mountArena()
    expect(api.fetchArena).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2_900) // the 3 s poll cadence has not fired yet
    expect(api.fetchArena).toHaveBeenCalledTimes(1)
    expect(t('battle-arena-feedback').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(2_200) // past roundEndsAt
    expect(api.fetchArena.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(t('battle-arena-text').text()).toBe('Soalan 12?')
    expect(t('battle-arena-progress').text()).toBe('Soalan 2/15')
    expect(states()).toEqual(['idle', 'idle', 'idle', 'idle'])
    expect(t('battle-arena-feedback').exists()).toBe(false)
    expect(t('battle-arena-waiting').exists()).toBe(false)
  })

  it('polls the view at the existing 3 s cadence while the battle is active', async () => {
    api.fetchArena.mockResolvedValue(answering({ roundEndsAt: iso(T0 + 60_000) }))
    await mountArena()
    expect(api.fetchArena).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(api.fetchArena).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(api.fetchArena).toHaveBeenCalledTimes(3)
  })

  it('a poll that finds the opponent answered moves a waiting screen to the reveal', async () => {
    api.fetchArena
      .mockResolvedValueOnce(answering({ youAnswered: true }))
      .mockResolvedValue(revealView())
    await mountArena()
    expect(t('battle-arena-waiting').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(t('battle-arena-waiting').exists()).toBe(false)
    expect(states()).toEqual(['dimmed', 'correct', 'dimmed', 'dimmed'])
  })

  it('a failed poll keeps the current screen', async () => {
    api.fetchArena.mockResolvedValueOnce(answering()).mockRejectedValue(new Error('net'))
    await mountArena()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(t('battle-arena-text').text()).toBe('Soalan 11?')
  })

  it('the robot opponent carries the chip "Latihan"', async () => {
    api.fetchArena.mockResolvedValue(
      answering({
        players: {
          A: { name: 'Aina', school: 'SK A' },
          B: { name: 'Robot PrestasiPlus', school: '', isBot: true },
        },
      }),
    )
    await mountArena()
    expect(t('battle-arena-player-B').text()).toContain('Robot PrestasiPlus')
    expect(t('battle-arena-robot-B').text()).toBe('Latihan')
    expect(t('battle-arena-robot-A').exists()).toBe(false)
  })

  describe.each([
    ['win', finished('finished', 'A'), 'Anda menang!', 'text-success'],
    ['lose', finished('finished', 'B', 700, 1100), 'Anda kalah.', 'text-error'],
    ['draw', finished('finished', null, 800, 800), 'Seri!', 'text-toned'],
    ['draw 0-0 (a draw now, not player B)', finished('finished', null, 0, 0), 'Seri!', 'text-toned'],
    ['opponent forfeit', finished('forfeited', 'A', 500, 900), 'Lawan menyerah. Anda menang!', 'text-success'],
    ['own forfeit (menyerah or 3 timeouts)', finished('forfeited', 'B', 500, 900), 'Anda telah menyerah.', 'text-error'],
    ['abandoned (neutral)', finished('abandoned', null, 0, 0), 'Ditinggalkan', 'text-toned'],
  ] as const)('finished: %s', (_name, v, headline, tone) => {
    it(`shows "${headline}", the scores and the two buttons; no question, no countdown`, async () => {
      api.fetchArena.mockResolvedValue(v)
      await mountArena()
      expect(t('battle-arena-title').text()).toBe(headline)
      expect(t('battle-arena-title').classes()).toContain(tone)
      expect(t('battle-arena-final').text()).toBe(`${String(v.result!.scoreA)} vs ${String(v.result!.scoreB)}`)
      expect(t('battle-arena-again').text()).toBe('Kembali ke Arena')
      expect(t('battle-arena-history').text()).toBe('Sejarah Battle')
      expect(t('battle-arena-question').exists()).toBe(false)
      expect(options()).toHaveLength(0)
      // a finished battle is not polled
      const calls = api.fetchArena.mock.calls.length
      await vi.advanceTimersByTimeAsync(9_000)
      expect(api.fetchArena.mock.calls.length).toBe(calls)
    })
  })

  it('seat B reads its own result: winner B is "Anda menang!" for you = B', async () => {
    api.fetchArena.mockResolvedValue(finished('finished', 'B', 400, 1000, { you: 'B' }))
    await mountArena()
    expect(t('battle-arena-title').text()).toBe('Anda menang!')
  })

  it('the finished view of an old server without phase still shows the result', async () => {
    const legacy: ArenaView = { ...finished('finished', 'A') }
    delete legacy.phase
    api.fetchArena.mockResolvedValue(legacy)
    await mountArena()
    expect(t('battle-arena-title').text()).toBe('Anda menang!')
  })

  it('a result that arrives with the answer ends the battle after the view is read', async () => {
    api.fetchArena
      .mockResolvedValueOnce(answering({ index: 15, total: 15 }))
      .mockResolvedValue(finished('finished', 'A', 9000, 8000))
    api.answerArena.mockResolvedValue({
      accepted: true,
      phase: 'finished',
      result: { winner: 'A', scoreA: 9000, scoreB: 8000 },
    })
    await mountArena()
    await options()[0]!.trigger('click')
    await flushPromises()
    expect(t('battle-arena-title').text()).toBe('Anda menang!')
  })

  describe('"Main Lagi" (48:309)', () => {
    async function remember(mode: 'quick-match' | 'school-battle', uuid: string) {
      api.startBattle.mockResolvedValueOnce({
        status: 200,
        headers: {},
        body: { matched: true, battle_uuid: uuid },
      })
      const { effectScope } = await import('vue')
      effectScope().run(() => {
        void useBattleSearch({ onMatched: () => undefined }).start(mode, {
          question_type: 'biasa',
          open_to_all: false,
          subject_id: 3,
        })
      })
      await flushPromises()
    }

    it('shows next to "Kembali ke Arena" when this session started the battle from the lobby', async () => {
      await remember('quick-match', 'u1')
      api.fetchArena.mockResolvedValue(finished('finished', 'A'))
      await mountArena()
      expect(t('battle-arena-play-again').text()).toBe('Main Lagi')
      expect(t('battle-arena-again').text()).toBe('Kembali ke Arena')
    })

    it('is hidden when nothing is remembered for this battle (reload, deep link, Cabar Kawan)', async () => {
      await remember('quick-match', 'another-battle')
      api.fetchArena.mockResolvedValue(finished('finished', 'A'))
      await mountArena()
      expect(t('battle-arena-play-again').exists()).toBe(false)
      expect(t('battle-arena-again').text()).toBe('Kembali ke Arena')
    })
  })

  describe('"Menyerah" confirm (48:310)', () => {
    beforeEach(() => {
      confirmHost.count = 1
    })
    afterEach(() => {
      settleConfirm(false)
      confirmHost.count = 0
    })

    it('the trigger is "Menyerah" and opens the dialog with the 48 copy; "Menyerah" forfeits', async () => {
      api.fetchArena.mockResolvedValue(answering())
      api.forfeitBattle.mockResolvedValue({ status: 200, headers: {}, body: { success: true } })
      await mountArena()
      expect(t('battle-arena-forfeit').text()).toBe('Menyerah')
      await t('battle-arena-forfeit').trigger('click')
      expect(confirmState).toMatchObject({
        open: true,
        title: 'Menyerah battle ini?',
        message: 'Anda akan kalah dan tidak mendapat mata.',
        confirmLabel: 'Menyerah',
        cancelLabel: 'Teruskan Bermain',
        tone: 'error',
      })
      settleConfirm(true)
      await flushPromises()
      expect(api.forfeitBattle).toHaveBeenCalledExactlyOnceWith('u1')
    })

    it('"Teruskan Bermain" keeps playing and sends nothing', async () => {
      api.fetchArena.mockResolvedValue(answering())
      await mountArena()
      await t('battle-arena-forfeit').trigger('click')
      settleConfirm(false)
      await flushPromises()
      expect(api.forfeitBattle).not.toHaveBeenCalled()
      expect(t('battle-arena-text').exists()).toBe(true)
    })
  })
})
