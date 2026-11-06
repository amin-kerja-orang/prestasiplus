// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { DashboardRecentQuestion } from '../../api/types'
import HomeRecent from '../../components/dashboard-v2/HomeRecent.vue'

const row = (id: number, over: Partial<DashboardRecentQuestion> = {}): DashboardRecentQuestion => ({
  id,
  subjectName: 'Matematik',
  difficulty: 2,
  text: `Soalan ${String(id)}`,
  createdAt: '2026-11-01T10:00:00+08:00',
  levelCode: 'T4',
  figureThumbUrl: null,
  ...over,
})

const render = (questions: DashboardRecentQuestion[]) => mount(HomeRecent, { props: { questions } })

describe('HomeRecent "Soalan Terkini" (FR-MUR-2-8)', () => {
  it('shows the figure thumbnail only for a question that has a figure', () => {
    const w = render([row(1, { figureThumbUrl: '/api/files/AbCdEfGhIjKlMnOpQrStUv' }), row(2)])
    const items = w.findAll('[data-testid=dash-recent-item]')
    expect(items).toHaveLength(2)
    const img = items[0]?.get('[data-testid=dash-recent-figure]')
    expect(img?.attributes('src')).toBe('/api/files/AbCdEfGhIjKlMnOpQrStUv')
    expect(img?.attributes('alt')).toBe('Rajah soalan')
    expect(items[1]?.find('[data-testid=dash-recent-figure]').exists()).toBe(false)
  })

  it('is read only: the text is shown as given (cut on the server at 140 + "…"), with no link, button or answer key', () => {
    const text = `${'x'.repeat(140)}…`
    const w = render([row(1, { text })])
    expect(w.get('[data-testid=dash-recent-text]').text()).toBe(text)
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
    expect(w.text()).not.toMatch(/jawapan/i)
    expect(w.get('h2').text()).toContain('Soalan Terkini')
  })
})
