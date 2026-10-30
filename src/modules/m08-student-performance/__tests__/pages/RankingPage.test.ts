// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { Ranking } from '../../api/types'
import RankingPage from '../../pages/RankingPage.vue'

const api = vi.hoisted(() => ({ fetchRankings: vi.fn() }))
vi.mock('../../api/performance', () => api)

const lookups = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../lib/subject-options', () => lookups)

function row(rank: number, extra: Partial<Ranking['rows'][number]> = {}): Ranking['rows'][number] {
  return {
    rank,
    userId: null,
    name: `Pelajar Demo ${String(rank)}`,
    schoolName: 'SMK Contoh',
    tahap: 8,
    correct: 2223 * rank,
    accuracy: 93.48,
    ...extra,
  }
}

function ranking(extra: Partial<Ranking> = {}): Ranking {
  return {
    scope: 'nasional',
    title: 'Kedudukan Nasional',
    showFooter: true,
    states: ['Selangor'],
    rows: [row(1), row(2, { accuracy: 48.85, tahap: 10 }), row(3, { correct: 17612 })],
    total: 3,
    ...extra,
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/ranking'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/ranking', component: RankingPage }],
  })
  await router.push(url)
  wrapper = mount(RankingPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchRankings.mockReset()
  api.fetchRankings.mockResolvedValue(ranking())
  lookups.fetchSubjectOptions.mockReset()
  lookups.fetchSubjectOptions.mockResolvedValue([
    { id: 1, name: 'Bahasa Melayu' },
    { id: 3, name: 'Matematik' },
  ])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('RankingPage (M08 S19)', () => {
  it('shows the hero, the four pills and the filters', async () => {
    const w = await render()
    expect(w.get('h1').text()).toBe('Kedudukan')
    expect(w.get('[data-testid=ranking-subtitle]').text()).toBe('Nasional')
    expect(document.title).toBe('Kedudukan Nasional | PRESTASIPLUS')
    const pills = w.findAll('[data-testid=ranking-pills] a')
    expect(pills.map((p) => p.text())).toEqual(['Nasional', 'Negeri', 'Daerah', 'Sekolah'])
    expect(pills.map((p) => p.attributes('data-active'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ])
    const selects = w.findAllComponents({ name: 'Select' })
    const labels = (i: number): string[] =>
      (selects[i]?.props('items') as { label: string }[]).map((o) => o.label)
    expect(labels(0)).toEqual(['Semua Subjek', 'Bahasa Melayu', 'Matematik'])
    expect(labels(1)).toEqual(['Semua', 'Tingkatan 4', 'Tingkatan 5'])
    expect(selects).toHaveLength(2)
  })

  it('renders rows as plain names (no link, even without a user id) and the footer', async () => {
    const w = await render()
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(w.find('[data-testid=ranking-list] a').exists()).toBe(false)
    expect(rows[0]?.get('[data-testid=ranking-name]').text()).toBe('Pelajar Demo 1')
    expect(rows[0]?.get('[data-testid=ranking-rank]').text()).toBe('🥇')
    expect(rows[0]?.get('[data-testid=ranking-tahap]').text()).toBe('L8')
    expect(rows[0]?.get('[data-testid=ranking-betul]').text()).toBe('2,223')
    expect(rows[0]?.get('[data-testid=ranking-tepat]').text()).toBe('93.48%')
    expect(rows[0]?.get('[data-testid=ranking-tepat]').classes()).toContain('text-success')
    expect(rows[1]?.get('[data-testid=ranking-tepat]').classes()).toContain('text-error')
    expect(rows[2]?.get('[data-testid=ranking-betul]').text()).toBe('17,612')
    expect(w.findAll('thead th').map((d) => d.text())).toEqual([
      '#',
      'Pelajar',
      'Tahap',
      'Betul',
      'Tepat',
    ])
    expect(w.get('[data-testid=ranking-footer]').text()).toBe('Menunjukkan 3 dari 3 pelajar')
  })

  it('keeps the filters on the pills and sends them to the API', async () => {
    const w = await render('/ranking?subject_id=3&scope=nasional')
    expect(api.fetchRankings).toHaveBeenLastCalledWith(
      { scope: 'nasional', subjectId: 3 },
      expect.anything(),
    )
    const hrefs = w.findAll('[data-testid=ranking-pills] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      '/ranking?subject_id=3&scope=nasional',
      '/ranking?subject_id=3&scope=negeri',
      '/ranking?subject_id=3&scope=daerah',
      '/ranking?subject_id=3&scope=sekolah',
    ])
  })

  it('submits a select change as the query string', async () => {
    const w = await render()
    w.findAllComponents({ name: 'Select' })[1]?.vm.$emit('update:modelValue', 'T5')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ scope: 'nasional', tingkatan: 'T5' })
  })

  it('shows the negeri select on the negeri and daerah scopes and the state in the subtitle', async () => {
    api.fetchRankings.mockResolvedValue(ranking({ scope: 'negeri', showFooter: false }))
    const w = await render('/ranking?scope=negeri&negeri=Selangor')
    expect(w.get('[data-testid=ranking-subtitle]').text()).toBe('Selangor')
    expect(document.title).toBe('Kedudukan Selangor | PRESTASIPLUS')
    const options = (w.findAllComponents({ name: 'Select' })[2]?.props('items') as { label: string }[]).map(
      (o) => o.label,
    )
    expect(options).toEqual(['Pilih Negeri', 'Selangor'])
    expect(w.find('[data-testid=ranking-footer]').exists()).toBe(false)
    w.unmount()
    await render('/ranking?scope=daerah')
    expect(wrapper?.findAllComponents({ name: 'Select' })).toHaveLength(3)
    expect(wrapper?.get('[data-testid=ranking-subtitle]').text()).toBe('Daerah')
  })

  it('shows the empty state with the practice link', async () => {
    api.fetchRankings.mockResolvedValue(ranking({ rows: [], total: 0, showFooter: false }))
    const w = await render('/ranking?scope=sekolah')
    const empty = w.get('[data-testid=ranking-empty]')
    expect(empty.text()).toContain('🏆')
    expect(empty.text()).toContain('Tiada data kedudukan')
    expect(empty.text()).toContain('Mula menjawab soalan untuk muncul di papan kedudukan!')
    expect(w.get('[data-testid=ranking-start]').text()).toBe('Mula Latihan')
    expect(w.get('[data-testid=ranking-start]').attributes('href')).toBe('/practice')
  })

  it('activates no pill for an unknown scope', async () => {
    api.fetchRankings.mockResolvedValue(ranking({ scope: null, showFooter: false }))
    const w = await render('/ranking?scope=xyz')
    const active = w
      .findAll('[data-testid=ranking-pills] a')
      .map((p) => p.attributes('data-active'))
    expect(active).toEqual(['false', 'false', 'false', 'false'])
    expect(w.get('[data-testid=ranking-subtitle]').text()).toBe('Nasional')
    expect(w.find('[data-testid=ranking-footer]').exists()).toBe(false)
  })

  it('shows the load error with a retry', async () => {
    api.fetchRankings.mockRejectedValueOnce(new Error('boom'))
    const w = await render()
    expect(w.get('[data-testid=ranking-error]').text()).toContain('Maaf, berlaku ralat.')
    await w.get('[data-testid=ranking-error] button').trigger('click')
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(3)
  })
})
