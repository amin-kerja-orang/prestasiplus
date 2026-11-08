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

describe('ChallengeFriendModal invite body (S7-T01 part C)', () => {
  it('sends the chosen question_count with the receiver in the invite body', async () => {
    wrapper!.unmount()
    api.sendInvite.mockReset()
    api.sendInvite.mockResolvedValue({ status: 200, headers: {}, body: { success: true } })
    api.searchOpponent.mockResolvedValue({
      status: 200,
      headers: {},
      body: { users: [{ id: 77, name: 'Aina', school: '', avatar: null }] },
    })
    vi.stubGlobal('alert', vi.fn())
    wrapper = mount(ChallengeFriendModal, {
      attachTo: document.body,
      props: {
        open: true,
        params: { question_type: 'biasa', open_to_all: false, subject_id: 3, question_count: 20 },
      },
    })
    await flushPromises()
    await type('ai')
    vi.advanceTimersByTime(300)
    await flushPromises()
    document.querySelector<HTMLElement>('[data-testid="battle-challenge-result"]')!.click()
    await flushPromises()
    expect(api.sendInvite).toHaveBeenCalledWith({
      question_type: 'biasa',
      open_to_all: false,
      subject_id: 3,
      question_count: 20,
      receiver_id: 77,
    })
    vi.unstubAllGlobals()
  })
})
