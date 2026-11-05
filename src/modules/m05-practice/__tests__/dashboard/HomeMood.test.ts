// @vitest-environment jsdom
import { useToast } from '@nuxt/ui/composables'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import type { MoodValue } from '../../api/types'
import HomeMood from '../../components/dashboard-v2/HomeMood.vue'

const api = vi.hoisted(() => ({ fetchMoodToday: vi.fn(), postMood: vi.fn() }))
vi.mock('../../api/practice', () => api)

let wrapper: VueWrapper | null = null

async function render(today: MoodValue | null = null) {
  api.fetchMoodToday.mockResolvedValue({ mood: today })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })
  wrapper = mount(HomeMood, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const conflict = () => new ApiError({ status: 409, code: 'ALREADY_CHECKED_IN', message: 'Anda sudah merekodkan perasaan hari ini.' })

beforeEach(() => {
  api.fetchMoodToday.mockReset()
  api.postMood.mockReset()
  useToast().clear()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('HomeMood (S5-T04, FR-MUR-2-12, AC-MUR-2-8)', () => {
  it('asks "Bagaimana perasaan anda hari ini?" with the four labelled choices', async () => {
    const w = await render()
    expect(w.get('[data-testid=dash-mood]').text()).toContain('Bagaimana perasaan anda hari ini?')
    const labels = w.findAll('[data-testid=dash-mood-choices] button').map((b) => b.text())
    expect(labels).toEqual(['😄 Gembira', '🙂 Okay', '😟 Sedih', '😣 Tertekan'])
    expect(w.find('[data-testid=dash-mood-done]').exists()).toBe(false)
    expect(api.fetchMoodToday).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['gembira', '😄 Gembira', 'Gembira'],
    ['okay', '🙂 Okay', 'Okay'],
    ['sedih', '😟 Sedih', 'Sedih'],
    ['tertekan', '😣 Tertekan', 'Tertekan'],
  ] as const)('a tap on %s posts that value and shows "✓ %s"', async (value, label, word) => {
    api.postMood.mockResolvedValue({ mood: value, checkedOn: '2026-11-05' })
    const w = await render()
    await w.findAll('[data-testid=dash-mood-choices] button').find((b) => b.text() === label)!.trigger('click')
    await flushPromises()
    expect(api.postMood).toHaveBeenCalledWith(value)
    expect(w.get('[data-testid=dash-mood-done]').text()).toBe(`✓ ${word}`)
    expect(w.find('[data-testid=dash-mood-choices]').exists()).toBe(false)
  })

  it('after a reload with a stored choice, shows "✓ Sedih" and offers no choices', async () => {
    const w = await render('sedih')
    expect(w.get('[data-testid=dash-mood-done]').text()).toBe('✓ Sedih')
    expect(w.find('[data-testid=dash-mood-choices]').exists()).toBe(false)
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('a 409 shows the stored choice from the server, not the tapped one, and no toast', async () => {
    api.postMood.mockRejectedValue(conflict())
    const w = await render()
    api.fetchMoodToday.mockResolvedValue({ mood: 'okay' })
    await w.get('[data-testid=dash-mood-gembira]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid=dash-mood-done]').text()).toBe('✓ Okay')
    expect(useToast().toasts.value).toHaveLength(0)
  })

  it('any other error toasts "Gagal menyimpan. Sila cuba lagi." and keeps the choices', async () => {
    api.postMood.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))
    const w = await render()
    await w.get('[data-testid=dash-mood-sedih]').trigger('click')
    await flushPromises()
    expect(useToast().toasts.value.map((t) => t.title)).toEqual(['Gagal menyimpan. Sila cuba lagi.'])
    expect(w.find('[data-testid=dash-mood-done]').exists()).toBe(false)
    expect(w.findAll('[data-testid=dash-mood-choices] button')).toHaveLength(4)
  })

  it('offers the choices when today cannot be read', async () => {
    api.fetchMoodToday.mockRejectedValue(new Error('down'))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })
    wrapper = mount(HomeMood, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.findAll('[data-testid=dash-mood-choices] button')).toHaveLength(4)
  })
})
