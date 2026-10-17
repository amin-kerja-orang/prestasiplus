// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { ParentInviteView } from '../../api/parent-invite'
import JemputIbuBapaPage from '../../pages/JemputIbuBapaPage.vue'

const calls = vi.hoisted(() => ({ fetchParentInvite: vi.fn(), generateParentInvite: vi.fn() }))
vi.mock('../../api/parent-invite', () => calls)

const TOKEN_A = 'a'.repeat(64)
const TOKEN_B = 'b'.repeat(64)

function view(parents: ParentInviteView['parents'] = []): ParentInviteView {
  return { token: TOKEN_A, createdAt: '2026-10-02T09:00:00+08:00', parents }
}

const writeText = vi.fn()
let wrapper: VueWrapper | null = null
const t = (id: string) => wrapper!.get(`[data-testid=${id}]`)

async function render(): Promise<void> {
  wrapper = mount(JemputIbuBapaPage, { attachTo: document.body })
  await flushPromises()
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  calls.fetchParentInvite.mockReset().mockResolvedValue(view())
  calls.generateParentInvite.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  vi.useRealTimers()
  wrapper?.unmount()
  wrapper = null
})

describe('S1 content (FR-L45-04..07)', () => {
  it('shows the hero, the link card and its three buttons', async () => {
    await render()
    expect(t('jemput-hero').text()).toContain('Jemput Ibu Bapa 👨‍👩‍👧')
    expect(t('jemput-hero').text()).toContain(
      'Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda',
    )
    const card = t('jemput-link-card').text()
    expect(card).toContain('Link Jemputan')
    expect(card).toContain(
      'Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej.',
    )
    expect(t('jemput-copy').text()).toBe('Salin')
    expect(t('jemput-whatsapp').text()).toBe('Hantar via WhatsApp')
    expect(t('jemput-regenerate').text()).toBe('Jana Link Baru')
    const input = t('jemput-url').element as HTMLInputElement
    expect(input.readOnly).toBe(true)
    expect(input.value).toBe(`${window.location.origin}/ibu-bapa/terima/${TOKEN_A}`)
  })

  it('WhatsApp keeps its href and target but the click is cancelled (DV-L45-03)', async () => {
    await render()
    const a = t('jemput-whatsapp')
    const url = `${window.location.origin}/ibu-bapa/terima/${TOKEN_A}`
    expect(a.attributes('href')).toBe(
      'https://wa.me/?text=' +
        encodeURIComponent(
          `Salam ibu/bapa! Klik link ini untuk pantau perkembangan saya di PRESTASIPLUS: ${url}`,
        ),
    )
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    a.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe('connected parents (FR-L45-14..16)', () => {
  it('shows the empty state', async () => {
    await render()
    const text = t('jemput-parents-card').text()
    expect(text).toContain('Ibu Bapa Dihubungkan')
    expect(text).toContain('Belum ada ibu bapa dihubungkan')
    expect(text).toContain('Hantar link jemputan di atas')
  })

  it('lists parents by name A to Z with no remove control', async () => {
    calls.fetchParentInvite.mockResolvedValue(
      view([
        {
          id: 9,
          name: 'zainab Contoh',
          email: 'z@demo.test',
          linkedAt: '2026-10-02T09:00:00+08:00',
        },
        {
          id: 6,
          name: 'Ali Contoh',
          email: 'ali@demo.test',
          linkedAt: '2026-10-02T09:00:00+08:00',
        },
      ]),
    )
    await render()
    const names = wrapper!.findAll('[data-testid=jemput-parent-name]').map((n) => n.text())
    expect(names).toEqual(['Ali Contoh', 'zainab Contoh'])
    expect(t('jemput-parents-card').findAll('button')).toHaveLength(0)
    expect(wrapper!.find('[data-testid=jemput-empty]').exists()).toBe(false)
  })
})

describe('copy (FR-L45-08)', () => {
  it('shows "Disalin!" for 2 seconds after a successful write', async () => {
    await render()
    vi.useFakeTimers()
    await t('jemput-copy').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/ibu-bapa/terima/${TOKEN_A}`)
    expect(t('jemput-copy').text()).toBe('Disalin!')
    expect(t('jemput-copy').attributes('data-copied')).toBe('true')
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(t('jemput-copy').text()).toBe('Salin')
    expect(t('jemput-copy').attributes('data-copied')).toBe('false')
  })

  it('keeps "Salin" and shows no error when the clipboard rejects (DV-L45-04)', async () => {
    writeText.mockRejectedValue(new Error('no'))
    await render()
    await t('jemput-copy').trigger('click')
    await flushPromises()
    expect(t('jemput-copy').text()).toBe('Salin')
    expect(wrapper!.find('[data-testid=jemput-alert]').exists()).toBe(false)
  })
})

describe('regenerate (FR-L45-10..12)', () => {
  it('disables the button while pending, then swaps the link and shows the flash', async () => {
    let resolve!: (v: unknown) => void
    calls.generateParentInvite.mockReturnValue(new Promise((r) => (resolve = r)))
    await render()
    await t('jemput-regenerate').trigger('click')
    expect(t('jemput-regenerate').attributes('disabled')).toBeDefined()
    resolve({
      token: TOKEN_B,
      createdAt: '2026-10-02T09:05:00+08:00',
      status: 'Link jemputan baru telah dijana!',
    })
    await flushPromises()
    expect(t('jemput-regenerate').attributes('disabled')).toBeUndefined()
    expect((t('jemput-url').element as HTMLInputElement).value).toContain(TOKEN_B)
    expect(t('jemput-whatsapp').attributes('href')).toContain(
      encodeURIComponent(`/ibu-bapa/terima/${TOKEN_B}`),
    )
    expect(t('jemput-flash').text()).toContain('Link jemputan baru telah dijana!')
  })

  it('keeps the old link and shows the red alert when it fails', async () => {
    calls.generateParentInvite.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    await render()
    await t('jemput-regenerate').trigger('click')
    await flushPromises()
    expect(t('jemput-alert').text()).toContain('Ralat berlaku. Sila cuba lagi.')
    expect((t('jemput-url').element as HTMLInputElement).value).toContain(TOKEN_A)
    expect(wrapper!.find('[data-testid=jemput-flash]').exists()).toBe(false)
  })
})

describe('loading and load error (FR-L45-17)', () => {
  it('shows the spinner while loading', async () => {
    calls.fetchParentInvite.mockReturnValue(new Promise(() => {}))
    wrapper = mount(JemputIbuBapaPage, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-testid=jemput-loading]').exists()).toBe(true)
    expect(wrapper.find('[data-testid=jemput-hero]').exists()).toBe(false)
  })

  it('shows the alert and "Cuba lagi", which reloads', async () => {
    calls.fetchParentInvite.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    await render()
    expect(t('jemput-alert').text()).toContain('Ralat berlaku. Sila cuba lagi.')
    await t('jemput-retry').trigger('click')
    await flushPromises()
    expect(wrapper!.find('[data-testid=jemput-hero]').exists()).toBe(true)
    expect(wrapper!.find('[data-testid=jemput-alert]').exists()).toBe(false)
  })
})
