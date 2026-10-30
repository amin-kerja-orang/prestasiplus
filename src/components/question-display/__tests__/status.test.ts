// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import NotServedNotice from '../NotServedNotice.vue'
import type { VisibilityRowData } from '../types'
import VisibilityList from '../VisibilityList.vue'

const rows: VisibilityRowData[] = [
  { family: 'latih-tubi', name: 'Latih Tubi, Bab, Aku Salah', visible: true },
  { family: 'databank-mock', name: 'Databank, Mock', visible: true },
  {
    family: 'tracking-a',
    name: 'Tracking A',
    visible: false,
    reason: 'Tiada dalam mana-mana set Tracking A.',
    actionLabel: 'Buka Tracking A',
  },
  {
    family: 'struktur-subjektif',
    name: 'Struktur, Subjektif',
    visible: false,
    reason: 'Bukan soalan berstruktur.',
  },
  { family: 'simulasi-kuiz', name: 'Simulasi, Kuiz', visible: true },
  {
    family: 'permainan-battle',
    name: 'Permainan, Battle',
    visible: false,
    reason: 'Ada imej dan permainan ini tidak memaparkan imej.',
  },
  { family: 'pksk', name: 'PKSK', visible: false, reason: 'Bukan soalan PKSK.' },
]

describe('VisibilityList', () => {
  it('summary counts the visible rows; list is closed by default and opens with Lihat', async () => {
    const w = mount(VisibilityList, { props: { rows } })
    expect(w.find('[data-testid=visibility-summary]').text()).toBe(
      'Dilihat murid di 3 daripada 7 aktiviti',
    )
    expect(w.find('[data-testid=visibility-list]').exists()).toBe(false)
    const t = w.find('[data-testid=visibility-toggle]')
    expect(t.text()).toBe('Lihat')
    expect(t.attributes('aria-expanded')).toBe('false')
    await t.trigger('click')
    expect(w.findAll('[data-testid=visibility-list] > li')).toHaveLength(7)
    expect(w.find('[data-testid=visibility-toggle]').attributes('aria-expanded')).toBe('true')
    expect(w.find('[data-testid=visibility-toggle]').text()).toBe('Sembunyi')
  })

  it('rows say Boleh dilihat / Tidak boleh dilihat; reason only for hidden ones', () => {
    const w = mount(VisibilityList, { props: { rows, expanded: true } })
    const ok = w.find('[data-testid=vis-latih-tubi]')
    expect(ok.text()).toContain('Boleh dilihat')
    expect(ok.text()).not.toContain('Tidak boleh dilihat')
    expect(ok.find('[data-testid=vis-reason]').exists()).toBe(false)
    const no = w.find('[data-testid=vis-tracking-a]')
    expect(no.text()).toContain('Tidak boleh dilihat')
    expect(no.find('[data-testid=vis-reason]').text()).toBe('Tiada dalam mana-mana set Tracking A.')
  })

  it('emits the action of a hidden row', async () => {
    const w = mount(VisibilityList, { props: { rows, expanded: true } })
    await w.find('[data-testid=vis-tracking-a] [data-testid=vis-action]').trigger('click')
    expect(w.emitted('action')![0]).toEqual(['tracking-a'])
  })

  it('collapsible=false shows the list without a summary', () => {
    const w = mount(VisibilityList, { props: { rows, collapsible: false } })
    expect(w.find('[data-testid=visibility-summary]').exists()).toBe(false)
    expect(w.find('[data-testid=visibility-list]').exists()).toBe(true)
  })

  it('loading shows 7 skeleton rows; error shows the inline retry', () => {
    const l = mount(VisibilityList, { props: { rows: [], loading: true } })
    expect(l.findAll('[data-testid=visibility-skeleton] li')).toHaveLength(7)
    const e = mount(VisibilityList, { props: { rows: [], error: true } })
    expect(e.find('[data-testid=visibility-error]').exists()).toBe(true)
    expect(e.find('[data-testid=visibility-list]').exists()).toBe(false)
  })
})

describe('NotServedNotice', () => {
  it('chip "Tidak disajikan" plus the full line "Tidak dihidangkan kerana ...."', () => {
    const w = mount(NotServedNotice, { props: { reason: 'imej belum dimuat naik' } })
    expect(w.find('[data-testid=not-served-chip]').text()).toBe('Tidak disajikan')
    expect(w.find('[data-testid=not-served-reason]').text()).toBe(
      'Tidak dihidangkan kerana imej belum dimuat naik.',
    )
  })
  it('does not double the full stop', () => {
    const w = mount(NotServedNotice, { props: { reason: 'tiada kunci jawapan.' } })
    expect(w.find('[data-testid=not-served-reason]').text()).toBe(
      'Tidak dihidangkan kerana tiada kunci jawapan.',
    )
  })
  it('compact shows the chip only', () => {
    const w = mount(NotServedNotice, { props: { reason: 'x', compact: true } })
    expect(w.find('[data-testid=not-served-reason]').exists()).toBe(false)
  })
})
