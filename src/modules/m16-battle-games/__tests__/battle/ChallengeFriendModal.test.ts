// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ChallengeFriendModal from '../../components/battle/ChallengeFriendModal.vue'

const api = vi.hoisted(() => ({ searchOpponent: vi.fn(), sendInvite: vi.fn() }))
vi.mock('../../api/battle', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  ...api,
}))

let wrapper: VueWrapper | undefined

function input(): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>('[data-testid="battle-challenge-input"]')
  if (!el) throw new Error('search input not rendered')
  return el
}

/** One input event carrying the whole value, as a paste or an autofill does. */
async function type(value: string): Promise<void> {
  input().value = value
  input().dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

beforeEach(async () => {
  vi.useFakeTimers()
  api.searchOpponent.mockReset()
  api.searchOpponent.mockResolvedValue({ status: 200, headers: {}, body: { users: [] } })
  wrapper = mount(ChallengeFriendModal, {
    attachTo: document.body,
    props: { open: true, params: { question_type: 'biasa', open_to_all: false } },
  })
  await flushPromises()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('ChallengeFriendModal search', () => {
  it('searches the value just entered, not the value before it', async () => {
    await type('zzqxv')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(api.searchOpponent).toHaveBeenCalledTimes(1)
    expect(api.searchOpponent.mock.calls[0]?.[0]).toBe('zzqxv')
    expect(document.querySelector('[data-testid="battle-challenge-empty"]')?.textContent).toContain(
      'Tiada pelajar dijumpai',
    )
  })

  it('sends nothing for one character', async () => {
    await type('M')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(api.searchOpponent).not.toHaveBeenCalled()
  })
})
