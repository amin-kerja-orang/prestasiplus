// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ArenaView } from '../../api'
import BattleArenaPage from '../../pages/BattleArenaPage.vue'

const api = vi.hoisted(() => ({
  fetchArena: vi.fn(),
  answerArena: vi.fn(),
  forfeitBattle: vi.fn(),
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
