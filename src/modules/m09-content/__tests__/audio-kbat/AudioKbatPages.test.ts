// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'

import AudioKbatListPage from '../../pages/AudioKbatListPage.vue'
import AudioKbatPlayerPage from '../../pages/AudioKbatPlayerPage.vue'

const api = vi.hoisted(() => ({
  fetchAudioSets: vi.fn(),
  fetchAudioSet: vi.fn(),
  submitAudioAttempt: vi.fn(),
}))
vi.mock('../../api', () => api)

const options = vi.hoisted(() => ({ fetchLevelOptions: vi.fn(), fetchSubjectOptions: vi.fn() }))
vi.mock('../../api/admin-media', () => options)

/** A mounted component, seen only through its props and emitted v-model. */
interface Probe {
  props: (key: string) => unknown
  vm: { $emit: (event: string, value: unknown) => void }
}

const g = globalThis as { ResizeObserver?: unknown }
g.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const stub = { template: '<div />' }
const level = (w: VueWrapper) => w.findAllComponents(USelect)[0]! as unknown as Probe
const subject = (w: VueWrapper) => w.findAllComponents(USelect)[1]! as unknown as Probe
const groups = (w: VueWrapper) =>
  w.findAllComponents(URadioGroup) as unknown as Probe[] as unknown as Probe[]
const meta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null }
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/audio-kbat', name: 'm09-audio-kbat', component: stub },
      { path: '/audio-kbat/:id', name: 'm09-audio-kbat-player', component: stub },
    ],
  })
}

let wrapper: VueWrapper | null = null

async function mountList(path = '/audio-kbat') {
  const r = router()
  await r.push(path)
  await r.isReady()
  wrapper = mount(AudioKbatListPage, { global: { plugins: [r] } })
  await flushPromises()
  return { w: wrapper, r }
}

const SET = {
  id: 7,
  title: 'Set Ujian',
  instructions: 'Dengar dengan teliti.',
  sections: [1, 2].map((n) => ({
    no: n,
    title: `Audio ${String(n)}`,
    audioUrl: n === 1 ? '/storage/a.mp3' : null,
    questions: [
      {
        no: n,
        questionText: `Soalan ${String(n)}`,
        options: { A: 'a', B: 'b', C: 'c', D: 'd' },
        marks: 1,
      },
    ],
  })),
}

async function mountPlayer() {
  const r = router()
  await r.push('/audio-kbat/7')
  await r.isReady()
  wrapper = mount(AudioKbatPlayerPage, { props: { id: 7 }, global: { plugins: [r] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  for (const fn of [...Object.values(api), ...Object.values(options)]) fn.mockReset()
  api.fetchAudioSets.mockResolvedValue({ data: [], meta })
  options.fetchLevelOptions.mockResolvedValue({ data: [{ id: 10, name: 'Tingkatan 4' }], meta })
  options.fetchSubjectOptions.mockResolvedValue({
    data: [
      { id: 3, name: 'Matematik' },
      { id: 1, name: 'Bahasa Melayu' },
    ],
    meta,
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('AudioKbatListPage (S21)', () => {
  it('shows the hero, filter and the empty state', async () => {
    const { w } = await mountList()
    expect(w.get('h1').text()).toBe('Audio KBAT')
    expect(w.text()).toContain('Ujian Mendengar')
    expect(w.text()).toContain('Set ini tidak dirawak supaya audio kekal selari')
    expect(t(w, 'audio-empty').text()).toBe('Belum ada set Audio KBAT yang approved.')
    expect((subject(w).props('items') as { label: string }[]).map((o) => o.label)).toEqual([
      'Semua Subjek',
      'Bahasa Melayu',
      'Matematik',
    ])
    expect(w.get('[data-ds="filter-bar"]').text()).toContain('Tapis')
  })

  it('passes the URL filter to the API and keeps the values', async () => {
    const { w } = await mountList('/audio-kbat?education_level_id=10&subject_id=3')
    expect(api.fetchAudioSets.mock.calls[0]?.[0]).toEqual({ educationLevelId: 10, subjectId: 3 })
    expect(level(w).props('modelValue')).toBe('10')
    expect(subject(w).props('modelValue')).toBe('3')
  })

  it('"Tapis" navigates with the non-empty values', async () => {
    const { w, r } = await mountList()
    level(w).vm.$emit('update:modelValue', '10')
    await flushPromises()
    await t(w, 'audio-filter').trigger('submit')
    await flushPromises()
    expect(r.currentRoute.value.path).toBe('/audio-kbat')
    expect(r.currentRoute.value.query).toEqual({ education_level_id: '10' })
  })

  it('lists sets linking to the player', async () => {
    api.fetchAudioSets.mockResolvedValue({
      data: [
        {
          id: 7,
          title: 'Set Ujian',
          educationLevel: { id: 10, name: 'Tingkatan 4' },
          subject: { id: 1, name: 'Bahasa Melayu' },
        },
      ],
      meta,
    })
    const { w } = await mountList()
    expect(t(w, 'set-link').attributes('href')).toBe('/audio-kbat/7')
    expect(t(w, 'set-title').text()).toBe('Set Ujian')
    expect(t(w, 'set-level').text()).toBe('Tingkatan 4')
    expect(w.find('[data-testid=audio-empty]').exists()).toBe(false)
  })

  it('shows an error box when the load fails', async () => {
    api.fetchAudioSets.mockRejectedValue(new Error('x'))
    const { w } = await mountList()
    expect(w.find('[data-testid=audio-error]').exists()).toBe(true)
  })
})

describe('AudioKbatPlayerPage (provisional)', () => {
  it('renders sections with audio, radios and "Hantar"', async () => {
    api.fetchAudioSet.mockResolvedValue(SET)
    const w = await mountPlayer()
    expect(t(w, 'player-title').text()).toBe('Set Ujian')
    expect(w.findAll('[data-testid=audio-section]')).toHaveLength(2)
    expect(w.findAll('audio')).toHaveLength(1)
    expect(w.find('[data-testid=section-no-audio]').exists()).toBe(true)
    expect(groups(w)).toHaveLength(2)
    expect(groups(w)[0]?.props('items')).toHaveLength(4)
    expect(t(w, 'player-submit').text()).toBe('Hantar')
  })

  it('posts only the answered questions and shows the score', async () => {
    api.fetchAudioSet.mockResolvedValue(SET)
    api.submitAudioAttempt.mockResolvedValue({ score: 1, totalMarks: 2 })
    const w = await mountPlayer()
    groups(w)[0]?.vm.$emit('update:modelValue', 'A')
    await flushPromises()
    await t(w, 'player-form').trigger('submit')
    await flushPromises()
    expect(api.submitAudioAttempt).toHaveBeenCalledWith(7, { answers: [{ no: 1, choice: 'A' }] })
    expect(t(w, 'result-score').text()).toBe('1')
    expect(t(w, 'result-total').text()).toBe('2')
    expect(w.find('[data-testid=player-submit]').exists()).toBe(false)
  })

  it('shows the server message on a failed submit and keeps the form', async () => {
    api.fetchAudioSet.mockResolvedValue(SET)
    api.submitAudioAttempt.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Medan ini diperlukan.' }),
    )
    const w = await mountPlayer()
    await t(w, 'player-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'submit-error').text()).toContain('Medan ini diperlukan.')
    expect(w.find('[data-testid=player-submit]').exists()).toBe(true)
  })

  it('raises the in-place 404 outcome for an unknown set', async () => {
    api.fetchAudioSet.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Set audio 9 tidak dijumpai.' }),
    )
    const w = await mountPlayer()
    expect(useRouteOutcome().value).toBe(404)
    setRouteOutcome(null)
    expect(w.find('[data-testid=player-form]').exists()).toBe(false)
  })
})
